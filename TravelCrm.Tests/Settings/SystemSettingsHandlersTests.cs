using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Features.Settings.System.Commands;
using TravelCrm.Api.Features.Settings.System.Queries;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Tests.Settings;

public class SystemSettingsHandlersTests
{
    private static (ApplicationDbContext db, FakeTenantContext tenant, Guid tenantId) NewDb() => TestDb.New();

    [Fact]
    public async Task Get_returns_defaults_when_no_row_exists()
    {
        var (db, tenant, _) = NewDb();
        var h = new GetSystemSettingsQueryHandler(db, tenant);

        var r = await h.Handle(new GetSystemSettingsQuery(), default);

        r.IsSuccess.Should().BeTrue();
        r.Value!.DateFormat.Should().Be("dd/MM/yyyy");
        r.Value.DefaultCurrencyCode.Should().Be("USD");
    }

    [Fact]
    public async Task Update_creates_row_on_first_save()
    {
        var (db, tenant, tenantId) = NewDb();
        var actor = Guid.NewGuid();
        var h = new UpdateSystemSettingsCommandHandler(db, tenant, new FakeCurrentUser(actor));

        var r = await h.Handle(new UpdateSystemSettingsCommand(
            DateFormat: "yyyy-MM-dd", TimeFormat: "HH:mm",
            DefaultTimeZone: "Asia/Kolkata", DefaultCurrencyCode: "inr",
            FiscalYearStartMonth: 4, FiscalYearStartDay: 1), default);

        r.IsSuccess.Should().BeTrue();
        r.Value!.DefaultCurrencyCode.Should().Be("INR", "handler upper-cases the code");
        (await db.SystemSettings.CountAsync(s => s.TenantId == tenantId)).Should().Be(1);
    }

    [Fact]
    public async Task Update_rejects_caller_without_permission()
    {
        var (db, tenant, _) = NewDb();
        var h = new UpdateSystemSettingsCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid(), hasPermission: false));

        var r = await h.Handle(new UpdateSystemSettingsCommand(
            "dd/MM/yyyy", "HH:mm", "UTC", "USD", 1, 1), default);

        r.IsSuccess.Should().BeFalse();
        r.Error.Should().Contain("permission");
    }
}
