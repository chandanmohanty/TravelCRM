using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Features.Settings.Invoice.Commands;
using TravelCrm.Api.Features.Settings.Invoice.Queries;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Tests.Settings;

public class InvoiceSettingsHandlersTests
{
    private static (ApplicationDbContext db, FakeTenantContext tenant, Guid tenantId) NewDb() => TestDb.New();

    [Fact]
    public void Validator_requires_SEQ_token_in_template()
    {
        var validator = new UpdateInvoiceSettingsCommandValidator();

        var bad = validator.Validate(new UpdateInvoiceSettingsCommand(
            NumberingTemplate: "INV/{FY}/0001",
            GstNumber: null, GstLegalName: null, GstAddress: null,
            GstStateCode: null, DefaultTerms: null, DefaultNotes: null));

        bad.IsValid.Should().BeFalse();
        bad.Errors.Should().Contain(e => e.ErrorMessage.Contains("{SEQ}"));
    }

    [Fact]
    public async Task Update_persists_GST_and_defaults()
    {
        var (db, tenant, tenantId) = NewDb();
        var h = new UpdateInvoiceSettingsCommandHandler(
            db, tenant, new FakeCurrentUser(Guid.NewGuid()));

        var r = await h.Handle(new UpdateInvoiceSettingsCommand(
            NumberingTemplate: "INV/{FY}/{SEQ:0000}",
            GstNumber: "27ABCDE1234F1Z5", GstLegalName: "Acme Pvt Ltd",
            GstAddress: "1 Main St", GstStateCode: "MH",
            DefaultTerms: "Net 30", DefaultNotes: "Thank you."), default);

        r.IsSuccess.Should().BeTrue();
        var row = await db.InvoiceSettings.SingleAsync(s => s.TenantId == tenantId);
        row.GstNumber.Should().Be("27ABCDE1234F1Z5");
        row.DefaultTerms.Should().Be("Net 30");
    }
}
