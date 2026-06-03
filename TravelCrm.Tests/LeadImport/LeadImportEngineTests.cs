using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Features.Crm.LeadImport;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Tests.LeadImport;

// Uses the project's shared EF InMemory test fixture (TestDb). Sqlite was
// considered but EnsureCreated trips on Postgres-flavoured HasFilter SQL
// (e.g. "lead_id IS NOT NULL") baked into ApplicationDbContext, which this
// task is not allowed to modify.
public sealed class LeadImportEngineTests : IDisposable
{
    private readonly ApplicationDbContext _db;
    private readonly Guid _tenant;

    public LeadImportEngineTests()
    {
        (_db, _, _tenant) = TestDb.New();
    }

    private LeadImportEngine Engine() => new(_db);

    private static IReadOnlyList<IReadOnlyDictionary<string, string>> Rows(
        params (string email, string first)[] rs) =>
        rs.Select(r => (IReadOnlyDictionary<string, string>)
            new Dictionary<string, string> { ["E"] = r.email, ["F"] = r.first }).ToList();

    private static readonly Dictionary<string, string> Map =
        new() { ["email"] = "E", ["firstName"] = "F" };

    [Fact]
    public async Task Excel_path_creates_new_leads()
    {
        var r = await Engine().ApplyAsync(_tenant, Rows(("a@b.com", "Bob")), Map, "email", null, null, default);
        Assert.Equal(1, r.Created);
        Assert.Equal(1, await _db.Leads.CountAsync());
    }

    [Fact]
    public async Task Excel_path_updates_existing_by_key()
    {
        _db.Leads.Add(new Lead { TenantId = _tenant, Email = "a@b.com", FirstName = "Old" });
        await _db.SaveChangesAsync();
        var r = await Engine().ApplyAsync(_tenant, Rows(("A@B.com", "New")), Map, "email", null, null, default);
        Assert.Equal(1, r.Updated);
        Assert.Equal("New", (await _db.Leads.SingleAsync(l => l.TenantId == _tenant)).FirstName);
    }

    [Fact]
    public async Task In_file_duplicate_key_first_wins()
    {
        var r = await Engine().ApplyAsync(_tenant,
            Rows(("a@b.com", "First"), ("a@b.com", "Second")), Map, "email", null, null, default);
        Assert.Equal(1, r.Created);
        Assert.Equal(1, r.Skipped);
        Assert.Equal("First", (await _db.Leads.SingleAsync()).FirstName);
    }

    [Fact]
    public async Task Sheets_path_skips_unchanged_row_on_second_run()
    {
        var src = new LeadImportSource { TenantId = _tenant, DisplayName = "S" };
        _db.LeadImportSources.Add(src); await _db.SaveChangesAsync();

        var r1 = await Engine().ApplyAsync(_tenant, Rows(("a@b.com", "Bob")), Map, "email", src.Id, null, default);
        Assert.Equal(1, r1.Created);
        var r2 = await Engine().ApplyAsync(_tenant, Rows(("a@b.com", "Bob")), Map, "email", src.Id, null, default);
        Assert.Equal(1, r2.Skipped);
        Assert.Equal(0, r2.Updated);
    }

    [Fact]
    public async Task Sheets_path_updates_when_content_hash_changes()
    {
        var src = new LeadImportSource { TenantId = _tenant, DisplayName = "S" };
        _db.LeadImportSources.Add(src); await _db.SaveChangesAsync();
        await Engine().ApplyAsync(_tenant, Rows(("a@b.com", "Bob")), Map, "email", src.Id, null, default);
        var r2 = await Engine().ApplyAsync(_tenant, Rows(("a@b.com", "Robert")), Map, "email", src.Id, null, default);
        Assert.Equal(1, r2.Updated);
        Assert.Equal("Robert", (await _db.Leads.SingleAsync()).FirstName);
    }

    [Fact]
    public async Task Invalid_email_row_is_failed_not_aborting_run()
    {
        var r = await Engine().ApplyAsync(_tenant,
            Rows(("bad", "X"), ("ok@b.com", "Y")), Map, "email", null, null, default);
        Assert.Equal(1, r.Created);
        Assert.Equal(1, r.Failed);
    }

    [Fact]
    public async Task Tenant_isolation_does_not_update_other_tenant_lead()
    {
        var other = Guid.NewGuid();
        _db.Leads.Add(new Lead { TenantId = other, Email = "a@b.com", FirstName = "Theirs" });
        await _db.SaveChangesAsync();
        var r = await Engine().ApplyAsync(_tenant, Rows(("a@b.com", "Mine")), Map, "email", null, null, default);
        Assert.Equal(1, r.Created);
        Assert.Equal("Theirs", (await _db.Leads.SingleAsync(l => l.TenantId == other)).FirstName);
    }

    public void Dispose() => _db.Dispose();
}
