using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Domain.Entities.Inventory;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Security;

namespace TravelCrm.Api.Infrastructure.Persistence;

public sealed class ApplicationDbContext(
    DbContextOptions<ApplicationDbContext> options,
    ITenantContext tenantContext,
    IDataProtectionProvider dataProtectionProvider)
    : IdentityDbContext<ApplicationUser, ApplicationRole, Guid>(options)
{
    private readonly ProtectedStringConverter _protectedString = new(dataProtectionProvider);
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<PlatformBrandSettings> PlatformBrandSettings => Set<PlatformBrandSettings>();
    public DbSet<TenantBrandSettings> TenantBrandSettings => Set<TenantBrandSettings>();
    public DbSet<StorageConfiguration> StorageConfigurations => Set<StorageConfiguration>();
    public DbSet<EmailConfiguration> EmailConfigurations => Set<EmailConfiguration>();

    // ── Identity module ──────────────────────────────────────────────────────
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<EmployeeIdSequence> EmployeeIdSequences => Set<EmployeeIdSequence>();
    public DbSet<IdentityActivity> IdentityActivities => Set<IdentityActivity>();

    // ── Settings ──────────────────────────────────────────────────────────────
    public DbSet<SystemSettings> SystemSettings => Set<SystemSettings>();
    public DbSet<InvoiceSettings> InvoiceSettings => Set<InvoiceSettings>();
    public DbSet<AiProviderConfiguration> AiProviderConfigurations => Set<AiProviderConfiguration>();
    public DbSet<WhatsAppProviderConfiguration> WhatsAppProviderConfigurations => Set<WhatsAppProviderConfiguration>();

    // ── Reminders ─────────────────────────────────────────────────────────────
    public DbSet<Reminder> Reminders => Set<Reminder>();

    // ── CRM ───────────────────────────────────────────────────────────────────
    public DbSet<Lead> Leads => Set<Lead>();

    // ── Task Management ───────────────────────────────────────────────────────
    public DbSet<TenantTask> TenantTasks => Set<TenantTask>();
    public DbSet<TaskType> TaskTypes => Set<TaskType>();
    public DbSet<TimeEntry> TimeEntries => Set<TimeEntry>();

    // ── Inventory ─────────────────────────────────────────────────────────────
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<Resource> Resources => Set<Resource>();
    public DbSet<PoolResource> PoolResources => Set<PoolResource>();
    public DbSet<AssetResource> AssetResources => Set<AssetResource>();
    public DbSet<ResourceCalendar> ResourceCalendar => Set<ResourceCalendar>();
    public DbSet<ResourceHold> ResourceHolds => Set<ResourceHold>();
    public DbSet<TenantSettings> TenantSettings => Set<TenantSettings>();

    private Guid? GetCurrentTenantId() => tenantContext.TenantId;

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Rename Identity tables
        builder.Entity<ApplicationUser>().ToTable("Users");
        builder.Entity<ApplicationRole>().ToTable("Roles");
        builder.Entity<IdentityUserRole<Guid>>().ToTable("UserRoles");
        builder.Entity<IdentityUserClaim<Guid>>().ToTable("UserClaims");
        builder.Entity<IdentityUserLogin<Guid>>().ToTable("UserLogins");
        builder.Entity<IdentityRoleClaim<Guid>>().ToTable("RoleClaims");
        builder.Entity<IdentityUserToken<Guid>>().ToTable("UserTokens");

        // ApplicationUser config
        builder.Entity<ApplicationUser>(b =>
        {
            b.Property(u => u.FirstName).HasMaxLength(100).IsRequired();
            b.Property(u => u.LastName).HasMaxLength(100).IsRequired();
            b.Property(u => u.Department).HasMaxLength(100);
            b.Property(u => u.JobTitle).HasMaxLength(100);
            b.Property(u => u.EmployeeId).HasMaxLength(50);

            b.Property(u => u.PreferredLanguage).HasMaxLength(10).HasDefaultValue("en");
            b.Property(u => u.TimeZone).HasMaxLength(50).HasDefaultValue("UTC");
            b.Property(u => u.CurrencyCode).HasMaxLength(5).HasDefaultValue("USD");

            // Unique email per tenant (tenant users)
            b.HasIndex(u => new { u.TenantId, u.NormalizedEmail })
             .IsUnique()
             .HasDatabaseName("ix_users_tenant_email")
             .HasFilter("is_deleted = false AND tenant_id IS NOT NULL");

            // Globally unique email for platform admins (TenantId IS NULL)
            b.HasIndex(u => u.NormalizedEmail)
             .IsUnique()
             .HasDatabaseName("ix_users_platform_email")
             .HasFilter("is_deleted = false AND tenant_id IS NULL");

            // Employee ID unique per tenant (for non-deleted users with an ID set)
            b.HasIndex(u => new { u.TenantId, u.EmployeeId })
             .IsUnique()
             .HasDatabaseName("ix_users_tenant_employee_id")
             .HasFilter("is_deleted = false AND employee_id IS NOT NULL");
        });

        // ApplicationRole config
        builder.Entity<ApplicationRole>(b =>
        {
            b.Property(r => r.Description).HasMaxLength(500);
            b.Property(r => r.Slug).HasMaxLength(100);
            b.Property(r => r.TenantId).IsRequired(false);
            // Role slug unique within scope (tenant or platform)
            b.HasIndex(r => new { r.TenantId, r.Slug })
             .IsUnique()
             .HasDatabaseName("ix_roles_tenant_slug")
             .HasFilter("slug IS NOT NULL");
        });

        // Tenant
        builder.Entity<Tenant>(b =>
        {
            b.HasKey(t => t.Id);
            b.Property(t => t.Name).HasMaxLength(200).IsRequired();
            b.Property(t => t.Slug).HasMaxLength(100).IsRequired();
            b.HasIndex(t => t.Slug).IsUnique();
            b.Property(t => t.DefaultLanguage).HasMaxLength(10).HasDefaultValue("en");
            b.Property(t => t.DefaultTimeZone).HasMaxLength(50).HasDefaultValue("UTC");
            b.Property(t => t.DefaultCurrencyCode).HasMaxLength(5).HasDefaultValue("USD");
        });

        // PlatformBrandSettings — singleton row
        builder.Entity<PlatformBrandSettings>(b =>
        {
            b.HasKey(p => p.Id);
            b.Property(p => p.DisplayName).HasMaxLength(200);
            b.Property(p => p.LogoLightUrl).HasMaxLength(500);
            b.Property(p => p.LogoDarkUrl).HasMaxLength(500);
            b.Property(p => p.FaviconUrl).HasMaxLength(500);
            b.Property(p => p.PrimaryColorHex).HasMaxLength(7);
            b.Property(p => p.SupportEmail).HasMaxLength(256);
            b.Property(p => p.SupportUrl).HasMaxLength(500);
        });

        // TenantBrandSettings — 1-to-1 with Tenant, cascade delete
        builder.Entity<TenantBrandSettings>(b =>
        {
            b.HasKey(t => t.Id);
            b.HasIndex(t => t.TenantId).IsUnique();
            b.HasOne<Tenant>()
                .WithOne()
                .HasForeignKey<TenantBrandSettings>(t => t.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
            b.Property(t => t.DisplayName).HasMaxLength(200);
            b.Property(t => t.LogoLightUrl).HasMaxLength(500);
            b.Property(t => t.LogoDarkUrl).HasMaxLength(500);
            b.Property(t => t.FaviconUrl).HasMaxLength(500);
            b.Property(t => t.PrimaryColorHex).HasMaxLength(7);
            b.Property(t => t.SupportEmail).HasMaxLength(256);
            b.Property(t => t.SupportUrl).HasMaxLength(500);
        });

        // StorageConfiguration — multiple per scope, one active
        builder.Entity<StorageConfiguration>(b =>
        {
            b.HasKey(s => s.Id);
            b.Property(s => s.Name).HasMaxLength(200).IsRequired();
            b.Property(s => s.Driver).HasConversion<int>();
            b.HasIndex(s => new { s.TenantId, s.Name }).IsUnique();
            // LocalDisk
            b.Property(s => s.BasePath).HasMaxLength(500);
            // S3
            b.Property(s => s.AwsAccessKey).HasMaxLength(500);
            b.Property(s => s.AwsSecretKey).HasMaxLength(500);
            b.Property(s => s.AwsRegion).HasMaxLength(100);
            b.Property(s => s.AwsBucket).HasMaxLength(200);
            b.Property(s => s.AwsEndpoint).HasMaxLength(500);
            // Azure
            b.Property(s => s.AzureConnectionString).HasMaxLength(1000);
            b.Property(s => s.AzureContainerName).HasMaxLength(200);
            // GCS
            b.Property(s => s.GcsServiceAccountJson).HasColumnType("text");
            b.Property(s => s.GcsBucket).HasMaxLength(200);
            // Shared
            b.Property(s => s.AllowedContentTypes).HasColumnType("text");
        });

        // EmailConfiguration — multiple per scope, one active
        builder.Entity<EmailConfiguration>(b =>
        {
            b.HasKey(e => e.Id);
            b.Property(e => e.Name).HasMaxLength(200).IsRequired();
            b.Property(e => e.Provider).HasConversion<int>();
            b.HasIndex(e => new { e.TenantId, e.Name }).IsUnique();
            b.Property(e => e.SmtpHost).HasMaxLength(500);
            b.Property(e => e.Username).HasMaxLength(500);
            b.Property(e => e.Password).HasMaxLength(500);
            b.Property(e => e.SenderEmail).HasMaxLength(256).IsRequired();
            b.Property(e => e.SenderName).HasMaxLength(200).IsRequired();
            b.Property(e => e.ApiKey).HasMaxLength(2000);
            b.Property(e => e.ApiDomain).HasMaxLength(500);
            b.Property(e => e.AwsRegion).HasMaxLength(100);
        });

        // Permission catalog (global when TenantId = null; tenant-custom when set)
        builder.Entity<Permission>(b =>
        {
            b.HasKey(p => p.Id);
            b.Property(p => p.Slug).HasMaxLength(100).IsRequired();
            b.Property(p => p.Name).HasMaxLength(200).IsRequired();
            b.Property(p => p.Module).HasMaxLength(50).IsRequired();
            b.Property(p => p.Submodule).HasMaxLength(50).IsRequired();
            b.Property(p => p.Action).HasMaxLength(50).IsRequired();
            b.Property(p => p.Description).HasMaxLength(500);
            // Unique slug within scope (platform catalog vs tenant-custom)
            b.HasIndex(p => new { p.TenantId, p.Slug }).IsUnique();
            b.HasIndex(p => new { p.Module, p.Submodule, p.SortOrder });
        });

        // RolePermission — join with denormalized TenantId for defence-in-depth
        builder.Entity<RolePermission>(b =>
        {
            b.HasKey(rp => new { rp.RoleId, rp.PermissionId });
            b.HasOne<ApplicationRole>()
             .WithMany()
             .HasForeignKey(rp => rp.RoleId)
             .OnDelete(DeleteBehavior.Cascade);
            b.HasOne<Permission>()
             .WithMany()
             .HasForeignKey(rp => rp.PermissionId)
             .OnDelete(DeleteBehavior.Restrict);
            b.HasIndex(rp => rp.RoleId);
            b.HasIndex(rp => rp.TenantId);
        });

        // Department — tenant-scoped via BaseEntity
        builder.Entity<Department>(b =>
        {
            b.HasKey(d => d.Id);
            b.Property(d => d.Name).HasMaxLength(200).IsRequired();
            b.Property(d => d.Description).HasMaxLength(500);
            b.HasIndex(d => new { d.TenantId, d.Name })
             .IsUnique()
             .HasDatabaseName("ix_departments_tenant_name");
        });

        // PasswordResetToken — one-time, short-lived
        builder.Entity<PasswordResetToken>(b =>
        {
            b.HasKey(t => t.Id);
            b.Property(t => t.TokenHash).HasMaxLength(512).IsRequired();
            b.HasIndex(t => t.TokenHash).IsUnique();
            b.HasIndex(t => new { t.UserId, t.ExpiresAt });
            b.Property(t => t.IpAddress).HasMaxLength(45);
            b.HasOne<ApplicationUser>()
             .WithMany()
             .HasForeignKey(t => t.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // EmployeeIdSequence — per-tenant per-year counter.
        // Concurrency is enforced at SQL level via INSERT ... ON CONFLICT DO UPDATE
        // RETURNING inside EmployeeIdGenerator — no row-version column needed.
        builder.Entity<EmployeeIdSequence>(b =>
        {
            b.HasKey(s => new { s.TenantId, s.Year });
        });

        // IdentityActivity — user-facing activity feed (explicit writes in handlers)
        builder.Entity<IdentityActivity>(b =>
        {
            b.HasKey(a => a.Id);
            b.Property(a => a.ActivityType).HasMaxLength(100).IsRequired();
            b.Property(a => a.Description).HasMaxLength(500).IsRequired();
            b.Property(a => a.ActorName).HasMaxLength(200);
            b.HasIndex(a => new { a.TenantId, a.SubjectUserId, a.CreatedAt });
            b.HasIndex(a => new { a.TenantId, a.CreatedAt });
        });

        // AiProviderConfiguration — multiple per scope, one active. Mirrors EmailConfiguration.
        builder.Entity<AiProviderConfiguration>(b =>
        {
            b.HasKey(a => a.Id);
            b.Property(a => a.Name).HasMaxLength(200).IsRequired();
            b.Property(a => a.Provider).HasConversion<int>();
            b.Property(a => a.Model).HasMaxLength(200).IsRequired();
            b.Property(a => a.BaseUrl).HasMaxLength(500);
            // API key: encrypted at rest via ProtectedStringConverter. Column is
            // sized for post-encryption ciphertext (~2KB headroom for key rotation).
            b.Property(a => a.ApiKey).HasMaxLength(4000).HasConversion(_protectedString);
            b.HasIndex(a => new { a.TenantId, a.Name }).IsUnique();
        });

        // SystemSettings — 1-to-1 with Tenant (unique tenant index, cascade delete)
        builder.Entity<SystemSettings>(b =>
        {
            b.HasKey(s => s.Id);
            b.HasIndex(s => s.TenantId).IsUnique();
            b.HasOne<Tenant>().WithOne()
             .HasForeignKey<SystemSettings>(s => s.TenantId)
             .OnDelete(DeleteBehavior.Cascade);
            b.Property(s => s.DateFormat).HasMaxLength(20).IsRequired();
            b.Property(s => s.TimeFormat).HasMaxLength(20).IsRequired();
            b.Property(s => s.DefaultTimeZone).HasMaxLength(50).IsRequired();
            b.Property(s => s.DefaultCurrencyCode).HasMaxLength(5).IsRequired();
        });

        // InvoiceSettings — 1-to-1 with Tenant
        builder.Entity<InvoiceSettings>(b =>
        {
            b.HasKey(i => i.Id);
            b.HasIndex(i => i.TenantId).IsUnique();
            b.HasOne<Tenant>().WithOne()
             .HasForeignKey<InvoiceSettings>(i => i.TenantId)
             .OnDelete(DeleteBehavior.Cascade);
            b.Property(i => i.NumberingTemplate).HasMaxLength(100).IsRequired();
            b.Property(i => i.GstNumber).HasMaxLength(20);
            b.Property(i => i.GstLegalName).HasMaxLength(200);
            b.Property(i => i.GstAddress).HasMaxLength(500);
            b.Property(i => i.GstStateCode).HasMaxLength(5);
            b.Property(i => i.DefaultTerms).HasMaxLength(500);
            b.Property(i => i.DefaultNotes).HasMaxLength(2000);
        });

        // WhatsAppProviderConfiguration — mirrors AiProviderConfiguration
        builder.Entity<WhatsAppProviderConfiguration>(b =>
        {
            b.HasKey(w => w.Id);
            b.Property(w => w.Name).HasMaxLength(200).IsRequired();
            b.Property(w => w.Provider).HasConversion<int>();
            b.Property(w => w.PhoneNumber).HasMaxLength(30).IsRequired();
            b.Property(w => w.AppName).HasMaxLength(200);
            b.Property(w => w.BaseUrl).HasMaxLength(500);
            // API key encrypted at rest; 4000-char headroom for ciphertext post-rotation
            b.Property(w => w.ApiKey).HasMaxLength(4000).HasConversion(_protectedString);
            b.HasIndex(w => new { w.TenantId, w.Name }).IsUnique();
        });

        // Reminder
        builder.Entity<Reminder>(b =>
        {
            b.HasKey(r => r.Id);
            b.Property(r => r.Title).HasMaxLength(200).IsRequired();
            b.Property(r => r.MessageTemplate).HasMaxLength(2000).IsRequired();
            b.Property(r => r.TriggerType).HasConversion<int>();
            b.Property(r => r.Channel).HasConversion<int>();
            b.Property(r => r.Status).HasConversion<int>();
            b.Property(r => r.CronExpression).HasMaxLength(100);
            b.Property(r => r.EventName).HasMaxLength(100);
            b.Property(r => r.RecipientPhone).HasMaxLength(30);
            b.Property(r => r.RecipientEmail).HasMaxLength(256);
            b.Property(r => r.RecipientName).HasMaxLength(200);
            b.Property(r => r.HangfireJobId).HasMaxLength(200);
            b.HasIndex(r => new { r.TenantId, r.Status });
        });

        // Lead
        builder.Entity<Lead>(b =>
        {
            b.HasKey(l => l.Id);
            b.Property(l => l.FirstName).HasMaxLength(100).IsRequired();
            b.Property(l => l.LastName).HasMaxLength(100).IsRequired();
            b.Property(l => l.Email).HasMaxLength(256).IsRequired();
            b.Property(l => l.Phone).HasMaxLength(50).IsRequired(false);
            b.Property(l => l.Company).HasMaxLength(200).IsRequired(false);
            b.Property(l => l.JobTitle).HasMaxLength(200).IsRequired(false);
            b.Property(l => l.Status).HasConversion<int>();
            b.Property(l => l.Source).HasConversion<int>();
            b.Property(l => l.Score).HasDefaultValue(0);
            b.Property(l => l.AssignedTo).HasMaxLength(200).IsRequired(false);
            b.Property(l => l.Tags)
                .HasConversion(
                    v => string.Join('|', v),
                    v => v.Split('|', StringSplitOptions.RemoveEmptyEntries).ToList(),
                    new Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<List<string>>(
                        (a, b2) => a!.SequenceEqual(b2!),
                        v => v.Aggregate(0, (h, s) => HashCode.Combine(h, s.GetHashCode())),
                        v => v.ToList()))
                .HasMaxLength(1000);
            b.Property(l => l.Notes).HasMaxLength(4000).IsRequired(false);
            b.Property(l => l.EstimatedValue).HasColumnType("numeric(18,2)");
            b.HasIndex(l => l.TenantId);
        });

        // RefreshToken
        builder.Entity<RefreshToken>(b =>
        {
            b.HasKey(r => r.Id);
            b.Property(r => r.TokenHash).HasMaxLength(512).IsRequired();
            b.HasIndex(r => r.TokenHash).IsUnique();
            b.HasIndex(r => new { r.UserId, r.ExpiresAt });
        });

        // AuditLog - append only, no global filter
        builder.Entity<AuditLog>(b =>
        {
            b.HasKey(a => a.Id);
            b.Property(a => a.Action).HasMaxLength(100).IsRequired();
            b.Property(a => a.EntityType).HasMaxLength(100).IsRequired();
            b.Property(a => a.ActorEmail).HasMaxLength(256).IsRequired();
            b.Property(a => a.EntityLabel).HasMaxLength(256);
            b.Property(a => a.IpAddress).HasMaxLength(45);
            b.Property(a => a.ChangedFields).HasColumnType("text[]");
            b.HasIndex(a => new { a.TenantId, a.OccurredAt });
            b.HasIndex(a => new { a.TenantId, a.EntityId });
        });

        // Notification
        builder.Entity<Notification>(b =>
        {
            b.HasKey(n => n.Id);
            b.Property(n => n.Type).HasMaxLength(100).IsRequired();
            b.Property(n => n.Title).HasMaxLength(256).IsRequired();
            b.Property(n => n.Message).HasMaxLength(1000).IsRequired();
            b.HasIndex(n => new { n.UserId, n.TenantId, n.CreatedAt });
        });

        // TenantTask
        builder.Entity<TenantTask>(b =>
        {
            b.Property(t => t.Title).IsRequired().HasMaxLength(200);
            b.Property(t => t.Description).HasMaxLength(4000);
            b.Property(t => t.Status).HasConversion<int>();
            b.Property(t => t.Priority).HasConversion<int>();

            b.HasOne(t => t.Parent)
                .WithMany(t => t.Children)
                .HasForeignKey(t => t.ParentTaskId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(t => t.TaskType)
                .WithMany()
                .HasForeignKey(t => t.TaskTypeId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasMany(t => t.TimeEntries)
                .WithOne(te => te.Task)
                .HasForeignKey(te => te.TaskId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(t => new { t.TenantId, t.Status });
            b.HasIndex(t => new { t.TenantId, t.AssignedToUserId });
            b.HasIndex(t => new { t.TenantId, t.IsDeleted });
        });

        // TaskType
        builder.Entity<TaskType>(b =>
        {
            b.Property(t => t.Name).IsRequired().HasMaxLength(100);
            b.Property(t => t.Color).IsRequired().HasMaxLength(7);
            b.HasIndex(t => new { t.TenantId, t.Name }).IsUnique();
        });

        // TimeEntry
        builder.Entity<TimeEntry>(b =>
        {
            b.Property(t => t.Notes).HasMaxLength(500);
            b.HasIndex(t => new { t.TenantId, t.TaskId });
        });

        // ── Inventory ────────────────────────────────────────────────────────────

        builder.Entity<Supplier>(b =>
        {
            b.Property(s => s.Name).IsRequired().HasMaxLength(200);
            b.Property(s => s.SupplierType).HasConversion<int>();
            b.Property(s => s.ContactName).HasMaxLength(200);
            b.Property(s => s.ContactEmail).HasMaxLength(200);
            b.Property(s => s.ContactPhone).HasMaxLength(50);
            b.Property(s => s.Address).HasMaxLength(1000);
            b.HasIndex(s => new { s.TenantId, s.Name }).IsUnique();
            b.HasIndex(s => new { s.TenantId, s.SupplierType });
        });

        builder.Entity<Resource>(b =>
        {
            b.ToTable("resources");
            b.HasDiscriminator(r => r.Kind)
                .HasValue<PoolResource>(ResourceKind.Pool)
                .HasValue<AssetResource>(ResourceKind.Asset);

            b.Property(r => r.Type).IsRequired().HasMaxLength(50);
            b.Property(r => r.Name).IsRequired().HasMaxLength(200);
            b.Property(r => r.Status).HasConversion<int>();
            b.Property(r => r.Metadata).HasColumnType("jsonb");

            b.HasOne(r => r.Supplier)
                .WithMany()
                .HasForeignKey(r => r.SupplierId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(r => new { r.TenantId, r.Type, r.Status });
            b.HasIndex(r => new { r.TenantId, r.SupplierId });
        });

        builder.Entity<PoolResource>(b =>
        {
            b.Property(p => p.DefaultCapacity).IsRequired();
        });

        builder.Entity<AssetResource>(b =>
        {
            b.Property(a => a.AssetCode).HasMaxLength(100);
        });

        builder.Entity<ResourceCalendar>(b =>
        {
            b.Property(c => c.Slot).HasConversion<int?>();
            b.Property(c => c.Notes).HasMaxLength(500);
            b.Property(c => c.RowVersion).IsRowVersion();

            b.HasOne(c => c.Resource)
                .WithMany()
                .HasForeignKey(c => c.ResourceId)
                .OnDelete(DeleteBehavior.Cascade);

            // Whole-day buckets: PostgreSQL treats NULL != NULL in unique indexes, so we
            // need a partial index that excludes the null-slot rows from the multi-column
            // uniqueness and a separate index that covers them.
            b.HasIndex(c => new { c.TenantId, c.ResourceId, c.Date, c.Slot })
                .IsUnique()
                .HasFilter("slot IS NOT NULL");
            b.HasIndex(c => new { c.TenantId, c.ResourceId, c.Date })
                .IsUnique()
                .HasFilter("slot IS NULL");
        });

        builder.Entity<ResourceHold>(b =>
        {
            b.Property(h => h.Slot).HasConversion<int?>();
            b.Property(h => h.Status).HasConversion<int>();
            b.Property(h => h.BookingRef).HasMaxLength(100);
            b.Property(h => h.Notes).HasMaxLength(500);

            b.HasOne(h => h.Resource)
                .WithMany()
                .HasForeignKey(h => h.ResourceId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(h => new { h.TenantId, h.ResourceId, h.StartDate, h.EndDate });
            b.HasIndex(h => new { h.Status, h.ExpiresAt });
        });

        builder.Entity<TenantSettings>(b =>
        {
            b.ToTable("tenant_settings");
            b.Property(s => s.HoldTtlHours).HasDefaultValue(24);
            b.HasIndex(s => s.TenantId).IsUnique();
        });
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // Prevent AuditLog mutations
        var auditMutations = ChangeTracker.Entries<AuditLog>()
            .Where(e => e.State is EntityState.Modified or EntityState.Deleted)
            .ToList();
        if (auditMutations.Count > 0)
            throw new InvalidOperationException("AuditLog records are immutable.");

        return await base.SaveChangesAsync(cancellationToken);
    }
}
