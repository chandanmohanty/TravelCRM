using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TravelCrm.Api.Infrastructure.Multitenancy;

namespace TravelCrm.Api.Infrastructure.Persistence;

/// <summary>
/// Only used by EF tooling (<c>dotnet ef migrations …</c>). Reads the connection
/// string from the same sources the runtime uses — user-secrets + environment
/// variables — so no credential is baked into source control.
/// </summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var config = new ConfigurationBuilder()
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddUserSecrets<DesignTimeDbContextFactory>(optional: true)
            .AddEnvironmentVariables(prefix: "TRAVELCRM_")
            .Build();

        var connectionString = config.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "ConnectionStrings:DefaultConnection is not configured. Set it via " +
                "`dotnet user-secrets set \"ConnectionStrings:DefaultConnection\" \"…\"` " +
                "or the TRAVELCRM_ConnectionStrings__DefaultConnection env var.");
        }

        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
        optionsBuilder
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention();

        // Design-time stub: EF tooling never resolves a real tenant id.
        // The audit interceptor is not registered at design time either — migrations
        // don't generate AuditLog rows. Data protection uses an ephemeral provider
        // (not persisted) since migrations don't encrypt/decrypt real data.
        var dpProvider = new ServiceCollection()
            .AddDataProtection().Services
            .BuildServiceProvider()
            .GetRequiredService<IDataProtectionProvider>();

        return new ApplicationDbContext(
            optionsBuilder.Options, new DesignTimeTenantContext(), dpProvider);
    }

    private sealed class DesignTimeTenantContext : ITenantContext
    {
        public Guid? TenantId => null;
        public bool IsResolved => false;
    }
}
