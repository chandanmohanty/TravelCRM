using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Tests;

/// <summary>
/// Shared DbContext factory for handler tests. Uses EF InMemory + an ephemeral
/// Data Protection provider (tests don't need key persistence).
/// </summary>
internal static class TestDb
{
    private static readonly IDataProtectionProvider DataProtection =
        new ServiceCollection().AddDataProtection().Services
            .BuildServiceProvider()
            .GetRequiredService<IDataProtectionProvider>();

    public static (ApplicationDbContext db, FakeTenantContext tenant, Guid tenantId) New()
    {
        var tenantId = Guid.NewGuid();
        var tenant   = new FakeTenantContext(tenantId);
        var opts = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"test-{Guid.NewGuid()}").Options;
        return (new ApplicationDbContext(opts, tenant, DataProtection), tenant, tenantId);
    }
}

internal sealed class FakeTenantContext(Guid? tenantId) : ITenantContext
{
    public Guid? TenantId { get; } = tenantId;
    public bool IsResolved => TenantId is not null;
}

internal sealed class FakeCurrentUser(
    Guid userId,
    bool hasPermission = true,
    string email = "tester@travelcrm.test") : ICurrentUser
{
    public Guid UserId { get; } = userId;
    public string? Email { get; } = email;
    public IReadOnlyList<string> Roles { get; } = Array.Empty<string>();
    public bool IsPlatformAdmin => false;
    public bool IsAuthenticated => UserId != Guid.Empty;
    public bool IsInAnyRole(params string[] roles) => false;
    public bool HasPermission(string slug) => hasPermission;
}

internal sealed class CapturingActivityWriter : IIdentityActivityWriter
{
    public readonly List<(Guid subject, string type, string description, object? metadata)> Records = new();

    public void Record(Guid subjectUserId, string activityType, string description, object? metadata = null)
        => Records.Add((subjectUserId, activityType, description, metadata));
}
