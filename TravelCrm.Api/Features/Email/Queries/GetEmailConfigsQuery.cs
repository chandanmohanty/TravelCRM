using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Email.DTOs;
using TravelCrm.Api.Features.Storage.DTOs;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Email.Queries;

public sealed record GetEmailConfigsQuery(Guid? TenantId) : IRequest<Result<List<EmailConfigDto>>>;

public sealed class GetEmailConfigsQueryHandler(ApplicationDbContext db)
    : IRequestHandler<GetEmailConfigsQuery, Result<List<EmailConfigDto>>>
{
    public async Task<Result<List<EmailConfigDto>>> Handle(
        GetEmailConfigsQuery request, CancellationToken ct)
    {
        var rows = await db.EmailConfigurations
            .AsNoTracking()
            .Where(c => c.TenantId == request.TenantId)
            .OrderByDescending(c => c.IsActive)
            .ThenByDescending(c => c.CreatedAt)
            .ToListAsync(ct);

        var dtos = rows.Select(ToMaskedDto).ToList();
        return Result.Success(dtos);
    }

    internal static EmailConfigDto ToMaskedDto(Domain.Entities.EmailConfiguration c) => new(
        c.Id, c.TenantId, c.Name, c.Provider, c.IsActive,
        c.SmtpHost, c.SmtpPort, c.Username,
        CredentialMask.Mask(c.Password),
        c.EnableSsl,
        c.SenderEmail, c.SenderName,
        CredentialMask.Mask(c.ApiKey),
        c.ApiDomain, c.AwsRegion,
        c.CreatedAt, c.UpdatedAt);
}
