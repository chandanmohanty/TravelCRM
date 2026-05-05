using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Storage.DTOs;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Storage.Queries;

/// <summary>
/// Lists all storage configurations for a given scope. <c>TenantId = null</c>
/// returns platform-scoped configs; non-null returns that tenant's configs.
/// Sensitive fields are masked in the response.
/// </summary>
public sealed record GetStorageConfigsQuery(Guid? TenantId) : IRequest<Result<List<StorageConfigDto>>>;

public sealed class GetStorageConfigsQueryHandler(ApplicationDbContext db)
    : IRequestHandler<GetStorageConfigsQuery, Result<List<StorageConfigDto>>>
{
    public async Task<Result<List<StorageConfigDto>>> Handle(
        GetStorageConfigsQuery request, CancellationToken ct)
    {
        var rows = await db.StorageConfigurations
            .AsNoTracking()
            .Where(c => c.TenantId == request.TenantId)
            .OrderByDescending(c => c.IsActive)
            .ThenByDescending(c => c.CreatedAt)
            .ToListAsync(ct);

        var dtos = rows.Select(ToMaskedDto).ToList();
        return Result.Success(dtos);
    }

    internal static StorageConfigDto ToMaskedDto(Domain.Entities.StorageConfiguration c) => new(
        c.Id,
        c.TenantId,
        c.Name,
        c.Driver,
        c.IsActive,
        c.BasePath,
        c.AwsAccessKey,
        CredentialMask.Mask(c.AwsSecretKey),
        c.AwsRegion,
        c.AwsBucket,
        c.AwsEndpoint,
        CredentialMask.Mask(c.AzureConnectionString),
        c.AzureContainerName,
        CredentialMask.Mask(c.GcsServiceAccountJson),
        c.GcsBucket,
        c.MaxFileSizeBytes,
        c.AllowedContentTypes,
        c.CreatedAt,
        c.UpdatedAt);
}
