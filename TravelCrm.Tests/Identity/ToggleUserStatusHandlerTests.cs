using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using TravelCrm.Api.Features.Identity.Commands;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Tests.Identity;

public class ToggleUserStatusHandlerTests
{
    private static (ApplicationDbContext db, ITenantContext tenant, Guid tenantId) NewDb()
    {
        var (db, tenant, tenantId) = TestDb.New();
        return (db, tenant, tenantId);
    }

    private static ApplicationUser SeedUser(ApplicationDbContext db, Guid tenantId, UserStatus status = UserStatus.Active)
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserName = "jane@example.com",
            Email = "jane@example.com",
            FirstName = "Jane",
            LastName = "Doe",
            Status = status,
        };
        db.Users.Add(user);
        db.SaveChanges();
        return user;
    }

    [Fact]
    public async Task Fails_when_tenant_not_resolved()
    {
        var (db, _, _) = TestDb.New();
        var handler = new ToggleUserStatusCommandHandler(
            db, new FakeTenantContext(null), new FakeCurrentUser(Guid.NewGuid()),
            new CapturingActivityWriter(), NullLogger<ToggleUserStatusCommandHandler>.Instance);

        var result = await handler.Handle(new ToggleUserStatusCommand(Guid.NewGuid(), false), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("Tenant");
    }

    [Fact]
    public async Task Fails_when_permission_missing()
    {
        var (db, tenant, tenantId) = NewDb();
        var user = SeedUser(db, tenantId);

        var handler = new ToggleUserStatusCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid(), hasPermission: false),
            new CapturingActivityWriter(), NullLogger<ToggleUserStatusCommandHandler>.Instance);

        var result = await handler.Handle(new ToggleUserStatusCommand(user.Id, false), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("permission");
    }

    [Fact]
    public async Task Prevents_self_deactivation()
    {
        var (db, tenant, tenantId) = NewDb();
        var me = SeedUser(db, tenantId);

        var handler = new ToggleUserStatusCommandHandler(
            db, tenant, new FakeCurrentUser(me.Id),
            new CapturingActivityWriter(), NullLogger<ToggleUserStatusCommandHandler>.Instance);

        var result = await handler.Handle(new ToggleUserStatusCommand(me.Id, false), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("yourself");
    }

    [Fact]
    public async Task Deactivates_and_records_activity()
    {
        var (db, tenant, tenantId) = NewDb();
        var target = SeedUser(db, tenantId, UserStatus.Active);
        var actor = Guid.NewGuid();
        var activity = new CapturingActivityWriter();

        var handler = new ToggleUserStatusCommandHandler(
            db, tenant, new FakeCurrentUser(actor), activity,
            NullLogger<ToggleUserStatusCommandHandler>.Instance);

        var result = await handler.Handle(new ToggleUserStatusCommand(target.Id, false), default);

        result.IsSuccess.Should().BeTrue();
        (await db.Users.FindAsync(target.Id))!.Status.Should().Be(UserStatus.Inactive);
        activity.Records.Should().ContainSingle()
            .Which.type.Should().Be("user.deactivated");
    }

    [Fact]
    public async Task Rejects_user_from_different_tenant()
    {
        var (db, tenant, tenantId) = NewDb();
        var other = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.NewGuid(), // different tenant
            UserName = "other@example.com",
            Email = "other@example.com",
            FirstName = "Other",
            LastName = "Tenant",
            Status = UserStatus.Active
        };
        db.Users.Add(other);
        await db.SaveChangesAsync();

        var handler = new ToggleUserStatusCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid()),
            new CapturingActivityWriter(), NullLogger<ToggleUserStatusCommandHandler>.Instance);

        var result = await handler.Handle(new ToggleUserStatusCommand(other.Id, false), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("not found");
    }
}
