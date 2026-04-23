using FluentAssertions;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Leads.Queries;

namespace TravelCrm.Tests.Leads;

public class LeadQueryHandlersTests
{
    [Fact]
    public async Task List_rejects_caller_without_permission()
    {
        var (db, tenant, _) = TestDb.New();
        var h = new ListLeadsQueryHandler(db, tenant,
            new FakeCurrentUser(Guid.NewGuid(), hasPermission: false));

        var r = await h.Handle(new ListLeadsQuery(), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("permission");
    }

    [Fact]
    public async Task List_returns_only_tenant_leads()
    {
        var (db, tenant, tenantId) = TestDb.New();
        db.Leads.AddRange(
            new Lead { Id = Guid.NewGuid(), TenantId = tenantId,      FirstName = "Alice", LastName = "A", Email = "a@a.com", Status = LeadStatus.New, Source = LeadSource.Website },
            new Lead { Id = Guid.NewGuid(), TenantId = Guid.NewGuid(), FirstName = "Bob",   LastName = "B", Email = "b@b.com", Status = LeadStatus.New, Source = LeadSource.Website });
        await db.SaveChangesAsync();

        var h = new ListLeadsQueryHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new ListLeadsQuery(), default);

        r.IsSuccess.Should().BeTrue();
        r.Value!.Should().ContainSingle().Which.FirstName.Should().Be("Alice");
    }

    [Fact]
    public async Task Get_returns_failure_when_not_found()
    {
        var (db, tenant, _) = TestDb.New();
        var h = new GetLeadQueryHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));

        var r = await h.Handle(new GetLeadQuery(Guid.NewGuid()), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("not found");
    }

    [Fact]
    public async Task Get_returns_lead_for_correct_tenant()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var id = Guid.NewGuid();
        db.Leads.Add(new Lead { Id = id, TenantId = tenantId, FirstName = "Carol", LastName = "C",
            Email = "c@c.com", Status = LeadStatus.Qualified, Source = LeadSource.Referral });
        await db.SaveChangesAsync();

        var h = new GetLeadQueryHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new GetLeadQuery(id), default);

        r.IsSuccess.Should().BeTrue();
        r.Value!.FirstName.Should().Be("Carol");
    }

    [Fact]
    public async Task Get_returns_failure_for_lead_belonging_to_different_tenant()
    {
        var (db, tenant, tenantId) = TestDb.New();
        var foreignTenantId = Guid.NewGuid();
        var foreignId = Guid.NewGuid();
        db.Leads.Add(new Lead
        {
            Id = foreignId, TenantId = foreignTenantId,
            FirstName = "Eve", LastName = "E", Email = "e@e.com",
            Status = LeadStatus.New, Source = LeadSource.Website,
        });
        await db.SaveChangesAsync();

        var h = new GetLeadQueryHandler(db, tenant, new FakeCurrentUser(Guid.NewGuid()));
        var r = await h.Handle(new GetLeadQuery(foreignId), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("not found");
    }
}
