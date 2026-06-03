using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using TravelCrm.Api.Domain.Entities.Crm;
using TravelCrm.Api.Features.Crm.LeadImport;
using TravelCrm.Api.Infrastructure.Google;
using TravelCrm.Api.Infrastructure.Jobs;
using TravelCrm.Api.Infrastructure.Persistence;
using Xunit;

namespace TravelCrm.Tests.LeadImport;

/// <summary>
/// Exercises RunLeadImportSyncJob end-to-end against the real LeadImportEngine
/// with faked Google Token/Sheets adapters, plus boundary cases for the
/// dispatcher's IsDue helper. Uses the project's EF InMemory fixture
/// (TestDb.New) — same approach as LeadImportEngineTests.
/// </summary>
public sealed class SyncJobTests : IDisposable
{
    private readonly ApplicationDbContext _db;
    private readonly Guid _tenant;

    public SyncJobTests()
    {
        (_db, _, _tenant) = TestDb.New();
    }

    private static SheetValues FixedSheet(params (string email, string first)[] rows)
    {
        var headers = new List<string> { "Email", "First" };
        var dictRows = rows.Select(r => new Dictionary<string, string>
        {
            ["Email"] = r.email,
            ["First"] = r.first,
        }).ToList();
        return new SheetValues(headers, dictRows);
    }

    private sealed class StubTokenProvider : IGoogleTokenProvider
    {
        public Task<string> GetAccessTokenAsync(Guid tenantId, string refreshToken, CancellationToken ct)
            => Task.FromResult("test-access-token");

        public Task<(string refreshToken, string scopes)> ExchangeCodeAsync(string code, CancellationToken ct)
            => Task.FromResult(("rt", "spreadsheets.readonly userinfo.email"));

        public string BuildAuthUrl(string state) => $"https://accounts.example/?state={state}";

        public Task RevokeAsync(string refreshToken, CancellationToken ct) => Task.CompletedTask;
    }

    private sealed class StubSheetsReader(SheetValues values) : ISheetsReader
    {
        public Task<IReadOnlyList<SheetTab>> ListTabsAsync(string accessToken, string spreadsheetId, CancellationToken ct)
            => Task.FromResult<IReadOnlyList<SheetTab>>(new[] { new SheetTab("Sheet1") });

        public Task<SheetValues> ReadAsync(string accessToken, string spreadsheetId, string tab, CancellationToken ct)
            => Task.FromResult(values);
    }

    private async Task<LeadImportSource> SeedSourceAsync(
        string mappingJson = """{"email":"Email","firstName":"First"}""")
    {
        var src = new LeadImportSource
        {
            TenantId = _tenant,
            DisplayName = "S",
            SpreadsheetId = "abc",
            SheetName = "Sheet1",
            ColumnMapping = mappingJson,
            MatchKeyField = "email",
            Status = LeadImportSourceStatus.Active,
            SyncCadence = SyncCadence.Hourly,
        };
        _db.LeadImportSources.Add(src);
        _db.GoogleOAuthTokens.Add(new GoogleOAuthToken
        {
            TenantId = _tenant,
            RefreshToken = "rt",
            GrantedScopes = "spreadsheets.readonly",
            ConnectedByUserId = Guid.NewGuid(),
            ConnectedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
        return src;
    }

    [Fact]
    public async Task First_run_creates_leads_and_marks_success()
    {
        var src = await SeedSourceAsync();
        var values = FixedSheet(("a@b.com", "Bob"), ("c@d.com", "Carol"));

        var job = new RunLeadImportSyncJob(
            _db,
            new StubTokenProvider(),
            new StubSheetsReader(values),
            new LeadImportEngine(_db),
            NullLogger<RunLeadImportSyncJob>.Instance);

        await job.ExecuteAsync(src.Id, default);

        var after = await _db.LeadImportSources.SingleAsync(s => s.Id == src.Id);
        Assert.Equal(LeadImportSourceStatus.Active, after.Status);
        Assert.NotNull(after.LastSuccessAt);
        Assert.NotNull(after.LastResultJson);
        Assert.Null(after.LastError);
        Assert.Equal(2, await _db.Leads.CountAsync(l => l.TenantId == _tenant));
    }

    [Fact]
    public async Task Second_run_with_identical_data_skips_via_A3_hash()
    {
        var src = await SeedSourceAsync();
        var values = FixedSheet(("a@b.com", "Bob"));

        var job = new RunLeadImportSyncJob(
            _db,
            new StubTokenProvider(),
            new StubSheetsReader(values),
            new LeadImportEngine(_db),
            NullLogger<RunLeadImportSyncJob>.Instance);

        await job.ExecuteAsync(src.Id, default);
        // Clear the in-memory tracker so the second run starts cold (same DB).
        _db.ChangeTracker.Clear();

        await job.ExecuteAsync(src.Id, default);

        // Parse the last result; second run should have Skipped=1, Updated=0, Created=0.
        var after = await _db.LeadImportSources.SingleAsync(s => s.Id == src.Id);
        Assert.NotNull(after.LastResultJson);
        var json = System.Text.Json.JsonDocument.Parse(after.LastResultJson!);
        Assert.Equal(1, json.RootElement.GetProperty("Skipped").GetInt32());
        Assert.Equal(0, json.RootElement.GetProperty("Updated").GetInt32());
        Assert.Equal(0, json.RootElement.GetProperty("Created").GetInt32());
    }

    [Fact]
    public async Task Token_missing_sets_Error_status_and_LastError()
    {
        var src = new LeadImportSource
        {
            TenantId = _tenant,
            DisplayName = "S",
            SpreadsheetId = "abc",
            SheetName = "Sheet1",
            ColumnMapping = """{"email":"Email"}""",
            MatchKeyField = "email",
            Status = LeadImportSourceStatus.Active,
            SyncCadence = SyncCadence.Hourly,
        };
        _db.LeadImportSources.Add(src);
        await _db.SaveChangesAsync();
        // NO GoogleOAuthToken row → job should fail with "Google not connected".

        var job = new RunLeadImportSyncJob(
            _db,
            new StubTokenProvider(),
            new StubSheetsReader(FixedSheet(("a@b.com", "Bob"))),
            new LeadImportEngine(_db),
            NullLogger<RunLeadImportSyncJob>.Instance);

        await job.ExecuteAsync(src.Id, default);

        var after = await _db.LeadImportSources.SingleAsync(s => s.Id == src.Id);
        Assert.Equal(LeadImportSourceStatus.Error, after.Status);
        Assert.Contains("not connected", after.LastError!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Paused_source_is_skipped_with_no_polling()
    {
        var src = await SeedSourceAsync();
        src.Status = LeadImportSourceStatus.Paused;
        await _db.SaveChangesAsync();

        var job = new RunLeadImportSyncJob(
            _db,
            new StubTokenProvider(),
            new StubSheetsReader(FixedSheet(("a@b.com", "Bob"))),
            new LeadImportEngine(_db),
            NullLogger<RunLeadImportSyncJob>.Instance);

        await job.ExecuteAsync(src.Id, default);

        var after = await _db.LeadImportSources.SingleAsync(s => s.Id == src.Id);
        Assert.Equal(LeadImportSourceStatus.Paused, after.Status);
        Assert.Null(after.LastPolledAt);
        Assert.Equal(0, await _db.Leads.CountAsync(l => l.TenantId == _tenant));
    }

    [Fact]
    public void Dispatcher_IsDue_treats_Manual_as_never_due()
    {
        var s = new LeadImportSource { SyncCadence = SyncCadence.Manual, LastPolledAt = null };
        Assert.False(LeadImportSyncDispatcherJob.IsDue(s, DateTime.UtcNow));
    }

    [Fact]
    public void Dispatcher_IsDue_treats_never_polled_as_due()
    {
        var s = new LeadImportSource { SyncCadence = SyncCadence.Hourly, LastPolledAt = null };
        Assert.True(LeadImportSyncDispatcherJob.IsDue(s, DateTime.UtcNow));
    }

    [Fact]
    public void Dispatcher_IsDue_respects_cadence_interval()
    {
        var now = new DateTime(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);
        var hourly = new LeadImportSource { SyncCadence = SyncCadence.Hourly, LastPolledAt = now.AddMinutes(-30) };
        var due    = new LeadImportSource { SyncCadence = SyncCadence.Hourly, LastPolledAt = now.AddHours(-2) };
        Assert.False(LeadImportSyncDispatcherJob.IsDue(hourly, now));
        Assert.True(LeadImportSyncDispatcherJob.IsDue(due, now));
    }

    public void Dispose() => _db.Dispose();
}
