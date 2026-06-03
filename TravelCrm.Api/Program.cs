using System.Reflection;
using System.Text;
using FluentValidation;
using Hangfire;
using Hangfire.PostgreSql;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using TravelCrm.Api.Infrastructure.Auth;
using TravelCrm.Api.Infrastructure.Behaviors;
using TravelCrm.Api.Infrastructure.FileStorage;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Localization;
using TravelCrm.Api.Infrastructure.Middleware;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Subscriptions;
using TravelCrm.Api.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// ── Secret configuration providers ────────────────────────────────
// appsettings.json carries empty-string placeholders for DefaultConnection and Jwt:SecretKey.
// Real values flow in from:
//   • Development  → `dotnet user-secrets` (stored outside the repo)
//   • Production   → environment variables prefixed TRAVELCRM_
//                    e.g. TRAVELCRM_Jwt__SecretKey, TRAVELCRM_ConnectionStrings__DefaultConnection
// The env-var provider is registered AFTER user-secrets so production deploys override local dev.
builder.Configuration.AddEnvironmentVariables(prefix: "TRAVELCRM_");

// Fail fast if critical secrets are still the empty-string placeholders.
var criticalKeys = new[] { "ConnectionStrings:DefaultConnection", "Jwt:SecretKey" };
foreach (var key in criticalKeys)
{
    if (string.IsNullOrWhiteSpace(builder.Configuration[key]))
    {
        throw new InvalidOperationException(
            $"Configuration '{key}' is missing. Set it via `dotnet user-secrets set {key} …` " +
            $"in development or TRAVELCRM_{key.Replace(":", "__")} in production.");
    }
}

// Ensure wwwroot exists BEFORE the app pipeline is built — UseStaticFiles()
// probes for the directory at startup. If wwwroot is missing (fresh clone or
// first run after adding the Branding feature) the static file middleware
// silently falls back to serving nothing.
Directory.CreateDirectory(Path.Combine(builder.Environment.ContentRootPath, "wwwroot"));

// ── Logging ───────────────────────────────────────────────────────
// Full config (sinks, enrichers, levels) lives in appsettings.json `Serilog` section.
// Console + rolling File are always on; Seq is documented as an opt-in sink.
builder.Host.UseSerilog((ctx, cfg) => cfg.ReadFrom.Configuration(ctx.Configuration));

// ── Services ──────────────────────────────────────────────────────
// Every controller response is wrapped in ApiEnvelope<T> by this global filter
// (success: data payload, failure: error + errors + correlationId).
builder.Services.AddControllers(options =>
{
    options.Filters.Add<TravelCrm.Api.Infrastructure.Filters.ApiEnvelopeFilter>();
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpContextAccessor();

// Tenant + user abstractions — first real consumers are the Branding feature slice
builder.Services.AddScoped<ITenantContext, HttpTenantContext>();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();

// Subscription / feature gating (Phase 0). Scoped so its per-request entitlement
// cache lives for the duration of one HTTP request — avoids repeat DB reads
// when a handler checks multiple feature codes.
builder.Services.AddScoped<IFeatureGate, FeatureGate>();

// Identity module services
builder.Services.AddScoped<EmployeeIdGenerator>();
builder.Services.AddScoped<PasswordResetTokenService>();
builder.Services.AddScoped<IIdentityActivityWriter, IdentityActivityWriter>();
builder.Services.AddSingleton<IAppUrlProvider, ConfigAppUrlProvider>();

// Email sender resolver — resolves per-request from DB-configured active email provider
builder.Services.AddScoped<TravelCrm.Api.Infrastructure.Email.EmailSenderResolver>();

// Named HTTP clients for email providers — pooled & reused via IHttpClientFactory
// (rule: no `new HttpClient()`). 30s timeout is generous for transactional email APIs.
builder.Services.AddHttpClient(
    TravelCrm.Api.Infrastructure.Email.SendGridEmailSender.HttpClientName,
    c => c.Timeout = TimeSpan.FromSeconds(30));
builder.Services.AddHttpClient(
    TravelCrm.Api.Infrastructure.Email.MailgunEmailSender.HttpClientName,
    c => c.Timeout = TimeSpan.FromSeconds(30));

// AI providers (Claude / OpenAI) — named clients + the scope resolver.
builder.Services.AddScoped<TravelCrm.Api.Infrastructure.Ai.AiClientResolver>();
builder.Services.AddHttpClient(
    TravelCrm.Api.Infrastructure.Ai.AnthropicAiClient.HttpClientName,
    c => c.Timeout = TimeSpan.FromSeconds(60));
builder.Services.AddHttpClient(
    TravelCrm.Api.Infrastructure.Ai.OpenAiClient.HttpClientName,
    c => c.Timeout = TimeSpan.FromSeconds(60));

// WhatsApp providers (Gupshup / WATI) — named clients + the scope resolver.
builder.Services.AddScoped<TravelCrm.Api.Infrastructure.WhatsApp.WhatsAppClientResolver>();
builder.Services.AddHttpClient(
    TravelCrm.Api.Infrastructure.WhatsApp.GupshupWhatsAppClient.HttpClientName,
    c => c.Timeout = TimeSpan.FromSeconds(30));
builder.Services.AddHttpClient(
    TravelCrm.Api.Infrastructure.WhatsApp.WatiWhatsAppClient.HttpClientName,
    c => c.Timeout = TimeSpan.FromSeconds(30));

// Reminder Hangfire job — scoped so it gets DI-resolved infrastructure
builder.Services.AddScoped<TravelCrm.Api.Infrastructure.Jobs.ReminderJob>();
builder.Services.AddScoped<TravelCrm.Api.Infrastructure.Jobs.OverdueTasksJob>();
builder.Services.AddScoped<TravelCrm.Api.Infrastructure.Jobs.HoldExpirySweepJob>();

// Lead import — engine, tabular parsers, and the hourly staging sweep job.
// Two AddScoped calls for ITabularLeadParser is intentional: IEnumerable<ITabularLeadParser>
// resolves both, mirroring how IPipelineBehavior is registered.
builder.Services.AddScoped<TravelCrm.Api.Features.Crm.LeadImport.ILeadImportEngine,
    TravelCrm.Api.Features.Crm.LeadImport.LeadImportEngine>();
builder.Services.AddScoped<TravelCrm.Api.Features.Crm.LeadImport.Parsing.ITabularLeadParser,
    TravelCrm.Api.Features.Crm.LeadImport.Parsing.ClosedXmlLeadParser>();
builder.Services.AddScoped<TravelCrm.Api.Features.Crm.LeadImport.Parsing.ITabularLeadParser,
    TravelCrm.Api.Features.Crm.LeadImport.Parsing.CsvLeadParser>();
builder.Services.AddScoped<TravelCrm.Api.Infrastructure.Jobs.LeadImportStagingSweepJob>();

// File storage abstraction — resolves per-request from DB-configured active backend
// (tenant → platform fallback → appsettings local-disk default)
builder.Services.Configure<FileStorageOptions>(builder.Configuration.GetSection("FileStorage"));
builder.Services.AddScoped<FileStorageResolver>();
builder.Services.AddScoped<IFileStorage>(sp => sp.GetRequiredService<FileStorageResolver>().Resolve());

// Google Sheets OAuth app config — empty ClientId leaves the Google sync path dormant
// (Excel import remains fully functional).
builder.Services.Configure<TravelCrm.Api.Infrastructure.Google.GoogleSheetsOptions>(
    builder.Configuration.GetSection(
        TravelCrm.Api.Infrastructure.Google.GoogleSheetsOptions.SectionName));

// Multipart upload limit (matches RequestSizeLimit attribute on branding upload endpoints)
builder.Services.Configure<FormOptions>(opts =>
{
    opts.MultipartBodyLengthLimit = 5 * 1024 * 1024; // 5 MB
});

// EF Core + PostgreSQL + audit interceptor (auto-writes to audit_logs for every
// IAuditableEntity mutation inside the same SaveChanges transaction).
builder.Services.AddScoped<AuditSaveChangesInterceptor>();
builder.Services.AddDbContext<ApplicationDbContext>((sp, opts) =>
    opts.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"))
        .UseSnakeCaseNamingConvention()
        .AddInterceptors(sp.GetRequiredService<AuditSaveChangesInterceptor>()));

// ASP.NET Identity
builder.Services.AddIdentity<ApplicationUser, ApplicationRole>(opts =>
{
    opts.Password.RequiredLength = 8;
    opts.Password.RequireDigit = true;
    opts.Password.RequireLowercase = true;
    opts.Password.RequireUppercase = true;
    opts.Password.RequireNonAlphanumeric = false;
    opts.Lockout.MaxFailedAccessAttempts = 5;
    opts.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    opts.User.RequireUniqueEmail = false;
    opts.SignIn.RequireConfirmedEmail = false;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

// Data Protection — persists keys to disk so ciphertext survives restarts.
// In prod, point ApplicationName to a shared key ring (Azure Blob / Redis / shared FS)
// so replicas agree on the same master key. Used by ProtectedStringConverter.
builder.Services.AddDataProtection()
    .SetApplicationName("TravelCRM")
    .PersistKeysToFileSystem(new DirectoryInfo(
        Path.Combine(builder.Environment.ContentRootPath, "keys")));
builder.Services.AddSingleton<TravelCrm.Api.Infrastructure.Security.ProtectedStringConverter>();

// JWT Authentication
var jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>()!;
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
builder.Services.AddScoped<JwtTokenService>();

builder.Services.AddAuthentication(opts =>
{
    opts.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    opts.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(opts =>
{
    opts.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings.Issuer,
        ValidAudience = jwtSettings.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(jwtSettings.SecretKey)),
        ClockSkew = TimeSpan.Zero
    };
    opts.Events = new JwtBearerEvents
    {
        OnChallenge = async ctx =>
        {
            ctx.HandleResponse();
            ctx.Response.StatusCode = 401;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsJsonAsync(new TravelCrm.Api.Common.ApiEnvelope<object?>(
                Success: false, Data: null, Meta: null,
                Error: "Authentication required.",
                Errors: null,
                CorrelationId: ctx.HttpContext.Items["CorrelationId"] as string));
        },
        OnForbidden = async ctx =>
        {
            ctx.Response.StatusCode = 403;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsJsonAsync(new TravelCrm.Api.Common.ApiEnvelope<object?>(
                Success: false, Data: null, Meta: null,
                Error: "Insufficient permissions.",
                Errors: null,
                CorrelationId: ctx.HttpContext.Items["CorrelationId"] as string));
        }
    };
});

builder.Services.AddAuthorization(opts =>
{
    // Only tokens carrying is_platform_admin=true may access /api/platform/** routes
    opts.AddPolicy("PlatformAdmin", policy =>
        policy.RequireClaim(TravelCrm.Api.Infrastructure.Auth.CrmClaimTypes.IsPlatformAdmin, "true"));

    // Tenant administrator: must be authenticated AND hold an Admin or SuperAdmin role
    // claim. This is the first role-based policy in the app; the Branding feature uses it.
    opts.AddPolicy("TenantAdmin", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireRole("Admin", "SuperAdmin");
    });
});

// Resource-based authorization handlers (rule 7: IAuthorizationService).
// SameTenantHandler enforces that a resource's TenantId matches the caller's
// tenant context — used as defence-in-depth in handlers that take a resource id.
builder.Services.AddScoped<
    Microsoft.AspNetCore.Authorization.IAuthorizationHandler,
    TravelCrm.Api.Infrastructure.Authorization.SameTenantHandler>();

// MediatR
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly());
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
});

builder.Services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());

// Inventory — pricing strategy fallback. Resource-type-specific implementations
// (e.g. HotelSeasonalPricing) are added by future sub-projects.
builder.Services.AddScoped<TravelCrm.Api.Features.Inventory.Holds.IResourcePricing,
                           TravelCrm.Api.Features.Inventory.Holds.NullResourcePricing>();

// Health Checks
builder.Services.AddHealthChecks()
    .AddNpgSql(builder.Configuration.GetConnectionString("DefaultConnection")!,
        name: "postgres", tags: ["db", "critical"])
    .AddCheck("self", () => Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy(), tags: ["live"]);

// CORS — allow any localhost port in development, explicit origins in production
builder.Services.AddCors(opts => opts.AddDefaultPolicy(policy =>
{
    if (builder.Environment.IsDevelopment())
    {
        policy.SetIsOriginAllowed(origin =>
                  Uri.TryCreate(origin, UriKind.Absolute, out var uri) &&
                  uri.Host == "localhost")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    }
    else
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                      ?? [];
        policy.WithOrigins(origins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    }
}));

// Localization
builder.Services.AddLocalization(options => options.ResourcesPath = "Resources");

// ── Hangfire ──────────────────────────────────────────────────────
// Background/recurring job processing. Storage: Postgres (same DB as the app,
// schema `hangfire`). Server worker runs in-process. Dashboard is mounted at
// `/hangfire` and is platform-admin-only via HangfireDashboardAuthorization.
builder.Services.AddHangfire(cfg => cfg
    .SetDataCompatibilityLevel(Hangfire.CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UsePostgreSqlStorage(options =>
        options.UseNpgsqlConnection(
            builder.Configuration.GetConnectionString("DefaultConnection"))));
builder.Services.AddScoped<TravelCrm.Api.Infrastructure.Jobs.SampleHeartbeatJob>();
builder.Services.AddHangfireServer(opts =>
{
    opts.ServerName   = $"travelcrm-{Environment.MachineName}";
    opts.WorkerCount  = Math.Max(2, Environment.ProcessorCount);
    opts.Queues       = new[] { "default" };
});

// ── Build ──────────────────────────────────────────────────────────
var app = builder.Build();

// ── Migrations & Seed ─────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await db.Database.MigrateAsync();
    await SeedData.SeedAsync(scope.ServiceProvider);
}

// ── Middleware Pipeline ────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Correlation-id must wrap every other middleware so request logs + exceptions
// + envelope payloads can all reference the same id.
app.UseMiddleware<CorrelationIdMiddleware>();

app.UseSerilogRequestLogging();
app.UseCors();

// Serve static files including /uploads/branding/* used by the Branding feature.
// Harden upload responses to prevent SVG stored-XSS: nosniff blocks content-type
// sniffing, and a strict CSP prevents any embedded script in uploaded content
// (e.g. <script> inside an SVG) from executing when served from this origin.
app.UseStaticFiles(new Microsoft.AspNetCore.Builder.StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        if (ctx.Context.Request.Path.StartsWithSegments("/uploads"))
        {
            ctx.Context.Response.Headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'";
            ctx.Context.Response.Headers["X-Frame-Options"] = "DENY";
        }
    }
});

app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseMiddleware<TenantResolverMiddleware>();
app.UseMiddleware<RequestCultureMiddleware>();
app.UseAuthentication();
app.UseAuthorization();

// Hangfire dashboard — platform admins only.
app.UseHangfireDashboard("/hangfire", new Hangfire.DashboardOptions
{
    Authorization = new[] { new TravelCrm.Api.Infrastructure.Jobs.HangfireDashboardAuthorization() },
    DashboardTitle = "TravelCRM Jobs",
});

app.MapControllers();

// Register recurring jobs once the server has started.
using (var jobScope = app.Services.CreateScope())
{
    var jobManager = jobScope.ServiceProvider.GetRequiredService<Hangfire.IRecurringJobManager>();
    TravelCrm.Api.Infrastructure.Jobs.RecurringJobRegistrar.RegisterAll(jobManager);
}

app.MapHealthChecks("/health/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = c => c.Tags.Contains("live")
});
app.MapHealthChecks("/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    // /health is bypassed by the envelope filter — return the raw shape consumed
    // by dashboards/monitors unchanged, so existing integrations aren't broken.
    ResponseWriter = async (ctx, report) =>
    {
        ctx.Response.ContentType = "application/json";
        await ctx.Response.WriteAsJsonAsync(new
        {
            status = report.Status.ToString(),
            checks = report.Entries.Select(e => new { name = e.Key, status = e.Value.Status.ToString() })
        });
    }
});

await app.RunAsync();
