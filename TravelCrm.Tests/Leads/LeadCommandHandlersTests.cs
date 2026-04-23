using FluentAssertions;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Leads.Commands;

namespace TravelCrm.Tests.Leads;

public class LeadCommandHandlersTests
{
    [Fact]
    public async Task Create_rejects_caller_without_permission()
    {
        var (db, tenant, _) = TestDb.New();
        var h = new CreateLeadCommandHandler(db, tenant,
            new FakeCurrentUser(Guid.NewGuid(), hasPermission: false));

        var r = await h.Handle(new CreateLeadCommand(
            "Jane", "Doe", "jane@doe.com", "+1555", "Corp", "CEO",
            LeadStatus.New, LeadSource.Website, 50, "Alice",
            new[] { "VIP" }, "", 10_000m), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("permission");
    }

    [Fact]
    public async Task Create_persists_lead_and_returns_dto()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var h = new CreateLeadCommandHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));

        var r = await h.Handle(new CreateLeadCommand(
            "Jane", "Doe", "jane@doe.com", "+1555", "Corp", "CEO",
            LeadStatus.New, LeadSource.Website, 50, "Alice",
            new[] { "VIP" }, "Looks good", 10_000m), default);

        r.IsSuccess.Should().BeTrue();
        r.Value!.FirstName.Should().Be("Jane");
        r.Value.TenantId.Should().Be(tenantId);
        db.Leads.Should().HaveCount(1);
    }

    [Fact]
    public async Task Update_rejects_caller_without_permission()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var id = Guid.NewGuid();
        db.Leads.Add(new Lead { Id = id, TenantId = tenantId, FirstName = "X", LastName = "Y",
            Email = "x@y.com", Status = LeadStatus.New, Source = LeadSource.Other });
        await db.SaveChangesAsync();

        var h = new UpdateLeadCommandHandler(db, tenant,
            new FakeCurrentUser(Guid.NewGuid(), hasPermission: false));
        var r = await h.Handle(new UpdateLeadCommand(id,
            "X", "Y", "x@y.com", "", "", "", LeadStatus.Contacted,
            LeadSource.Other, 50, "Alice", Array.Empty<string>(), "", null), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("permission");
    }

    [Fact]
    public async Task Update_returns_failure_for_wrong_tenant()
    {
        var (db, tenant, _) = TestDb.New();
        var id = Guid.NewGuid();
        db.Leads.Add(new Lead { Id = id, TenantId = Guid.NewGuid(), FirstName = "X", LastName = "Y",
            Email = "x@y.com", Status = LeadStatus.New, Source = LeadSource.Other });
        await db.SaveChangesAsync();

        var h = new UpdateLeadCommandHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new UpdateLeadCommand(id,
            "X", "Y", "x@y.com", "", "", "", LeadStatus.Contacted,
            LeadSource.Other, 50, "Alice", Array.Empty<string>(), "", null), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("not found");
    }

    [Fact]
    public async Task Update_persists_changes()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var id = Guid.NewGuid();
        db.Leads.Add(new Lead { Id = id, TenantId = tenantId, FirstName = "Old", LastName = "Name",
            Email = "old@test.com", Status = LeadStatus.New, Source = LeadSource.Website });
        await db.SaveChangesAsync();

        var h = new UpdateLeadCommandHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new UpdateLeadCommand(id,
            "New", "Name", "old@test.com", "", "BigCo", "CTO",
            LeadStatus.Qualified, LeadSource.Referral, 80, "Bob",
            new[] { "Enterprise" }, "Big deal", 500_000m), default);

        r.IsSuccess.Should().BeTrue();
        r.Value!.FirstName.Should().Be("New");
        r.Value.Status.Should().Be("Qualified");
        r.Value.Score.Should().Be(80);

        var saved = await db.Leads.FindAsync(id);
        saved!.FirstName.Should().Be("New");
        saved.Company.Should().Be("BigCo");
        saved.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task Delete_removes_lead()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var id = Guid.NewGuid();
        db.Leads.Add(new Lead { Id = id, TenantId = tenantId, FirstName = "Del", LastName = "Me",
            Email = "del@me.com", Status = LeadStatus.New, Source = LeadSource.Other });
        await db.SaveChangesAsync();

        var h = new DeleteLeadCommandHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new DeleteLeadCommand(id), default);

        r.IsSuccess.Should().BeTrue();
        db.Leads.Should().BeEmpty();
    }

    [Fact]
    public async Task Delete_returns_failure_for_wrong_tenant()
    {
        var (db, tenant, _) = TestDb.New();
        var id = Guid.NewGuid();
        db.Leads.Add(new Lead { Id = id, TenantId = Guid.NewGuid(), FirstName = "X", LastName = "Y",
            Email = "x@y.com", Status = LeadStatus.New, Source = LeadSource.Other });
        await db.SaveChangesAsync();

        var h = new DeleteLeadCommandHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new DeleteLeadCommand(id), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("not found");
    }

    [Fact]
    public async Task Convert_sets_status_to_Converted()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var id = Guid.NewGuid();
        db.Leads.Add(new Lead { Id = id, TenantId = tenantId, FirstName = "Conv", LastName = "Me",
            Email = "conv@me.com", Status = LeadStatus.Qualified, Source = LeadSource.Referral });
        await db.SaveChangesAsync();

        var h = new ConvertLeadCommandHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new ConvertLeadCommand(id), default);

        r.IsSuccess.Should().BeTrue();
        r.Value!.Status.Should().Be("Converted");
        var saved = await db.Leads.FindAsync(id);
        saved!.Status.Should().Be(LeadStatus.Converted);
    }

    [Fact]
    public async Task Convert_rejects_unqualified_lead()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var id = Guid.NewGuid();
        db.Leads.Add(new Lead { Id = id, TenantId = tenantId, FirstName = "Unq", LastName = "Lead",
            Email = "unq@lead.com", Status = LeadStatus.Unqualified, Source = LeadSource.Website });
        await db.SaveChangesAsync();

        var h = new ConvertLeadCommandHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new ConvertLeadCommand(id), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("Unqualified");
    }

    [Fact]
    public async Task Delete_rejects_converted_lead()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var id = Guid.NewGuid();
        db.Leads.Add(new Lead { Id = id, TenantId = tenantId, FirstName = "Conv", LastName = "Lead",
            Email = "conv@lead.com", Status = LeadStatus.Converted, Source = LeadSource.Website });
        await db.SaveChangesAsync();

        var h = new DeleteLeadCommandHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new DeleteLeadCommand(id), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("Converted");
    }
}
