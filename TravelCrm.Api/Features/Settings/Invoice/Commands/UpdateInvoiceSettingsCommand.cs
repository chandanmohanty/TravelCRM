using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Settings.Invoice.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Settings.Invoice.Commands;

public sealed record UpdateInvoiceSettingsCommand(
    string  NumberingTemplate,
    string? GstNumber,
    string? GstLegalName,
    string? GstAddress,
    string? GstStateCode,
    string? DefaultTerms,
    string? DefaultNotes
) : IRequest<Result<InvoiceSettingsDto>>;

public sealed class UpdateInvoiceSettingsCommandValidator : AbstractValidator<UpdateInvoiceSettingsCommand>
{
    public UpdateInvoiceSettingsCommandValidator()
    {
        RuleFor(x => x.NumberingTemplate).NotEmpty().MaximumLength(100)
            .Must(t => t.Contains("{SEQ", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Numbering template must include a {SEQ} token.");
        RuleFor(x => x.GstNumber).MaximumLength(20);
        RuleFor(x => x.GstLegalName).MaximumLength(200);
        RuleFor(x => x.GstAddress).MaximumLength(500);
        RuleFor(x => x.GstStateCode).MaximumLength(5);
        RuleFor(x => x.DefaultTerms).MaximumLength(500);
        RuleFor(x => x.DefaultNotes).MaximumLength(2000);
    }
}

public sealed class UpdateInvoiceSettingsCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateInvoiceSettingsCommand, Result<InvoiceSettingsDto>>
{
    public async Task<Result<InvoiceSettingsDto>> Handle(UpdateInvoiceSettingsCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<InvoiceSettingsDto>("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.settings.update"))
            return Result.Failure<InvoiceSettingsDto>("You don't have permission to update settings.");

        var row = await db.InvoiceSettings.FirstOrDefaultAsync(i => i.TenantId == tenantId, ct);
        var actor = currentUser.UserId == Guid.Empty ? (Guid?)null : currentUser.UserId;

        if (row is null)
        {
            row = new InvoiceSettings
            {
                TenantId  = tenantId.Value,
                CreatedBy = actor,
            };
            db.InvoiceSettings.Add(row);
        }

        row.NumberingTemplate = cmd.NumberingTemplate;
        row.GstNumber         = cmd.GstNumber;
        row.GstLegalName      = cmd.GstLegalName;
        row.GstAddress        = cmd.GstAddress;
        row.GstStateCode      = cmd.GstStateCode;
        row.DefaultTerms      = cmd.DefaultTerms;
        row.DefaultNotes      = cmd.DefaultNotes;
        row.UpdatedAt         = DateTime.UtcNow;
        row.UpdatedBy         = actor;

        await db.SaveChangesAsync(ct);

        return Result.Success(new InvoiceSettingsDto(
            row.NumberingTemplate, row.NextSequence,
            row.GstNumber, row.GstLegalName, row.GstAddress, row.GstStateCode,
            row.DefaultTerms, row.DefaultNotes));
    }
}
