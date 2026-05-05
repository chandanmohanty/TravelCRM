using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Settings.Ai.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Settings.Ai.Queries;

public sealed record GetAiProviderConfigQuery(Guid Id) : IRequest<Result<AiProviderConfigDto>>;

public sealed class GetAiProviderConfigQueryHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<GetAiProviderConfigQuery, Result<AiProviderConfigDto>>
{
    public async Task<Result<AiProviderConfigDto>> Handle(
        GetAiProviderConfigQuery q, CancellationToken ct)
    {
        if (!currentUser.HasPermission("admin.ai.view"))
            return Result.Failure<AiProviderConfigDto>("You don't have permission to view AI provider settings.");

        var tenantId = tenantContext.TenantId;
        var r = await db.AiProviderConfigurations.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == q.Id && c.TenantId == tenantId, ct);
        if (r is null) return Result.Failure<AiProviderConfigDto>("AI provider config not found.");

        return Result.Success(new AiProviderConfigDto(
            r.Id, r.TenantId, r.Name, r.Provider.ToString(), r.Model,
            r.IsActive, !string.IsNullOrEmpty(r.ApiKey),
            r.BaseUrl, r.Temperature, r.MaxTokens,
            r.CreatedAt, r.UpdatedAt));
    }
}
