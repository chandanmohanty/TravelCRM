using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Settings.Ai.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Settings.Ai.Queries;

public sealed record ListAiProviderConfigsQuery
    : IRequest<Result<IReadOnlyList<AiProviderConfigDto>>>;

public sealed class ListAiProviderConfigsQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<ListAiProviderConfigsQuery, Result<IReadOnlyList<AiProviderConfigDto>>>
{
    public async Task<Result<IReadOnlyList<AiProviderConfigDto>>> Handle(
        ListAiProviderConfigsQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("admin.ai.view"))
            return Result.Failure<IReadOnlyList<AiProviderConfigDto>>(
                "You don't have permission to view AI provider settings.");

        var tenantId = tenantContext.TenantId;
        // Tenant admins see only their tenant's rows. Platform admins (tenantId = null)
        // see the platform defaults via their separate UI — keep the query scoped.
        var rows = await db.AiProviderConfigurations
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId)
            .OrderBy(c => c.Name)
            .ToListAsync(ct);

        var dtos = rows.Select(r => new AiProviderConfigDto(
            r.Id, r.TenantId, r.Name, r.Provider.ToString(), r.Model,
            r.IsActive, !string.IsNullOrEmpty(r.ApiKey),
            r.BaseUrl, r.Temperature, r.MaxTokens,
            r.CreatedAt, r.UpdatedAt)).ToList();

        return Result.Success<IReadOnlyList<AiProviderConfigDto>>(dtos);
    }
}
