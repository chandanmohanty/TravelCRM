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

public sealed record CreateAiProviderConfigCommand(
    string  Name,
    AiProvider Provider,
    string  Model,
    string? ApiKey,
    string? BaseUrl,
    double? Temperature,
    int?    MaxTokens,
    bool    IsActive
) : IRequest<Result<AiProviderConfigDto>>;

public sealed class CreateAiProviderConfigCommandValidator : AbstractValidator<CreateAiProviderConfigCommand>
{
    public CreateAiProviderConfigCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Model).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ApiKey).NotEmpty().WithMessage("API key is required.")
            .MaximumLength(2000);
        RuleFor(x => x.BaseUrl).MaximumLength(500);
        RuleFor(x => x.Temperature).InclusiveBetween(0.0, 2.0)
            .When(x => x.Temperature.HasValue);
        RuleFor(x => x.MaxTokens).GreaterThan(0).LessThanOrEqualTo(100_000)
            .When(x => x.MaxTokens.HasValue);
    }
}

public sealed class CreateAiProviderConfigCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<CreateAiProviderConfigCommand, Result<AiProviderConfigDto>>
{
    public async Task<Result<AiProviderConfigDto>> Handle(
        CreateAiProviderConfigCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<AiProviderConfigDto>("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.ai.update"))
            return Result.Failure<AiProviderConfigDto>("You don't have permission to update AI provider settings.");

        // Uniqueness: (TenantId, Name)
        if (await db.AiProviderConfigurations.AnyAsync(
            c => c.TenantId == tenantId && c.Name == cmd.Name, ct))
        {
            return Result.Failure<AiProviderConfigDto>("A config with this name already exists for this tenant.");
        }

        var actor = currentUser.UserId == Guid.Empty ? (Guid?)null : currentUser.UserId;

        // Enforce single-active-per-scope: if this one is going active, deactivate siblings.
        if (cmd.IsActive)
        {
            var actives = await db.AiProviderConfigurations
                .Where(c => c.TenantId == tenantId && c.IsActive)
                .ToListAsync(ct);
            foreach (var a in actives) a.IsActive = false;
        }

        var row = new AiProviderConfiguration
        {
            Id          = Guid.NewGuid(),
            TenantId    = tenantId,
            Name        = cmd.Name,
            Provider    = cmd.Provider,
            Model       = cmd.Model,
            ApiKey      = cmd.ApiKey,   // encrypted at write via ProtectedStringConverter
            BaseUrl     = string.IsNullOrWhiteSpace(cmd.BaseUrl) ? null : cmd.BaseUrl,
            Temperature = cmd.Temperature,
            MaxTokens   = cmd.MaxTokens,
            IsActive    = cmd.IsActive,
            CreatedBy   = actor,
        };
        db.AiProviderConfigurations.Add(row);
        await db.SaveChangesAsync(ct);

        return Result.Success(new AiProviderConfigDto(
            row.Id, row.TenantId, row.Name, row.Provider.ToString(), row.Model,
            row.IsActive, !string.IsNullOrEmpty(row.ApiKey),
            row.BaseUrl, row.Temperature, row.MaxTokens,
            row.CreatedAt, row.UpdatedAt));
    }
}
