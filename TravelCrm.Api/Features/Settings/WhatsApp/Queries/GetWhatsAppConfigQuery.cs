using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Settings.WhatsApp.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Settings.WhatsApp.Queries;

public sealed record GetWhatsAppConfigQuery(Guid Id) : IRequest<Result<WhatsAppConfigDto>>;

public sealed class GetWhatsAppConfigQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<GetWhatsAppConfigQuery, Result<WhatsAppConfigDto>>
{
    public async Task<Result<WhatsAppConfigDto>> Handle(
        GetWhatsAppConfigQuery query, CancellationToken ct)
    {
        if (!currentUser.HasPermission("admin.whatsapp.view"))
            return Result.Failure<WhatsAppConfigDto>("You don't have permission to view WhatsApp settings.");

        var tenantId = tenantContext.TenantId;

        var row = await db.WhatsAppProviderConfigurations
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == query.Id && c.TenantId == tenantId, ct);

        if (row is null) return Result.Failure<WhatsAppConfigDto>("WhatsApp config not found.");

        return Result.Success(new WhatsAppConfigDto(
            row.Id, row.TenantId, row.Name, row.Provider.ToString(), row.IsActive,
            !string.IsNullOrEmpty(row.ApiKey),
            row.PhoneNumber, row.AppName, row.BaseUrl,
            row.CreatedAt, row.UpdatedAt));
    }
}
