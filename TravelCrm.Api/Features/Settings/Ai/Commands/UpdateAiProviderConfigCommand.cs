using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Settings.Ai.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Settings.Ai.Commands;

/// <summary>
/// Updates an existing AI provider config. <see cref="ApiKey"/> is optional —
/// a null/empty value means "keep the existing key" so editing metadata
/// doesn't force re-entering the secret every time.
/// </summary>
public sealed record UpdateAiProviderConfigCommand(
    Guid    Id,
    string  Name,
    AiProvider Provider,
    string  Model,
    string? ApiKey,
    string? BaseUrl,
    double? Temperature,
    int?    MaxTokens,
    bool    IsActive
) : IRequest<Result<AiProviderConfigDto>>;

public sealed class UpdateAiProviderConfigCommandValidator : AbstractValidator<UpdateAiProviderConfigCommand>
{
    public UpdateAiProviderConfigCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Model).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ApiKey).MaximumLength(2000);
        RuleFor(x => x.BaseUrl).MaximumLength(500);
        RuleFor(x => x.Temperature).InclusiveBetween(0.0, 2.0).When(x => x.Temperature.HasValue);
        RuleFor(x => x.MaxTokens).GreaterThan(0).LessThanOrEqualTo(100_000).When(x => x.MaxTokens.HasValue);
    }
}

public sealed class UpdateAiProviderConfigCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateAiProviderConfigCommand, Result<AiProviderConfigDto>>
{
    public async Task<Result<AiProviderConfigDto>> Handle(
        UpdateAiProviderConfigCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<AiProviderConfigDto>("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.ai.update"))
            return Result.Failure<AiProviderConfigDto>("You don't have permission to update AI provider settings.");

        var row = await db.AiProviderConfigurations
            .FirstOrDefaultAsync(c => c.Id == cmd.Id && c.TenantId == tenantId, ct);
        if (row is null) return Result.Failure<AiProviderConfigDto>("AI provider config not found.");

        // Uniqueness: (TenantId, Name) — excluding the row being edited.
        if (await db.AiProviderConfigurations.AnyAsync(
            c => c.TenantId == tenantId && c.Name == cmd.Name && c.Id != cmd.Id, ct))
        {
            return Result.Failure<AiProviderConfigDto>("Another config with this name already exists for this tenant.");
        }

        // If making this row active, deactivate siblings first.
        if (cmd.IsActive && !row.IsActive)
        {
            var actives = await db.AiProviderConfigurations
                .Where(c => c.TenantId == tenantId && c.IsActive && c.Id != cmd.Id)
                .ToListAsync(ct);
            foreach (var a in actives) a.IsActive = false;
        }

        row.Name        = cmd.Name;
        row.Provider    = cmd.Provider;
        row.Model       = cmd.Model;
        // Rotate the key only when a non-empty value is supplied.
        if (!string.IsNullOrWhiteSpace(cmd.ApiKey))
            row.ApiKey = cmd.ApiKey;
        row.BaseUrl     = string.IsNullOrWhiteSpace(cmd.BaseUrl) ? null : cmd.BaseUrl;
        row.Temperature = cmd.Temperature;
        row.MaxTokens   = cmd.MaxTokens;
        row.IsActive    = cmd.IsActive;
        row.UpdatedAt   = DateTime.UtcNow;
        row.UpdatedBy   = currentUser.UserId == Guid.Empty ? null : currentUser.UserId;

        await db.SaveChangesAsync(ct);

        return Result.Success(new AiProviderConfigDto(
            row.Id, row.TenantId, row.Name, row.Provider.ToString(), row.Model,
            row.IsActive, !string.IsNullOrEmpty(row.ApiKey),
            row.BaseUrl, row.Temperature, row.MaxTokens,
            row.CreatedAt, row.UpdatedAt));
    }
}
