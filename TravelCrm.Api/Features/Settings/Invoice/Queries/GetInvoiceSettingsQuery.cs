using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Settings.Invoice.DTOs;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Settings.Invoice.Queries;

public sealed record GetInvoiceSettingsQuery : IRequest<Result<InvoiceSettingsDto>>;

public sealed class GetInvoiceSettingsQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext)
    : IRequestHandler<GetInvoiceSettingsQuery, Result<InvoiceSettingsDto>>
{
    public async Task<Result<InvoiceSettingsDto>> Handle(GetInvoiceSettingsQuery q, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<InvoiceSettingsDto>("Tenant context not resolved.");

        var row = await db.InvoiceSettings.AsNoTracking()
            .FirstOrDefaultAsync(i => i.TenantId == tenantId, ct);
        row ??= new InvoiceSettings { TenantId = tenantId.Value };

        return Result.Success(new InvoiceSettingsDto(
            row.NumberingTemplate, row.NextSequence,
            row.GstNumber, row.GstLegalName, row.GstAddress, row.GstStateCode,
            row.DefaultTerms, row.DefaultNotes));
    }
}
