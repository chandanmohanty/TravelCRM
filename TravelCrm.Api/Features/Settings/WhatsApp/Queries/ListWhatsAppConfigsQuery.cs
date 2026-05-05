using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Settings.WhatsApp.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Settings.WhatsApp.Queries;

public sealed record ListWhatsAppConfigsQuery : IRequest<Result<IReadOnlyList<WhatsAppConfigDto>>>;

public sealed class ListWhatsAppConfigsQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ListWhatsAppConfigsQuery, Result<IReadOnlyList<WhatsAppConfigDto>>>
{
    public async Task<Result<IReadOnlyList<WhatsAppConfigDto>>> Handle(
        ListWhatsAppConfigsQuery _, CancellationToken ct)
    {
        if (!currentUser.HasPermission("admin.whatsapp.view"))
            return Result.Failure<IReadOnlyList<WhatsAppConfigDto>>("You don't have permission to view WhatsApp settings.");

        var tenantId = tenantContext.TenantId;

        var rows = await db.WhatsAppProviderConfigurations
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId)
            .OrderBy(c => c.Name)
            .ToListAsync(ct);

        var dtos = rows.Select(c => new WhatsAppConfigDto(
            c.Id, c.TenantId, c.Name, c.Provider.ToString(), c.IsActive,
            !string.IsNullOrEmpty(c.ApiKey),
            c.PhoneNumber, c.AppName, c.BaseUrl,
            c.CreatedAt, c.UpdatedAt))
            .ToList();

        return Result.Success<IReadOnlyList<WhatsAppConfigDto>>(dtos);
    }
}
