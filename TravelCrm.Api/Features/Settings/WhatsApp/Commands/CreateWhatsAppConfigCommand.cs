using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Settings.WhatsApp.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Settings.WhatsApp.Commands;

public sealed record CreateWhatsAppConfigCommand(
    string          Name,
    WhatsAppProvider Provider,
    string          PhoneNumber,
    string?         ApiKey,
    string?         AppName,
    string?         BaseUrl,
    bool            IsActive
) : IRequest<Result<WhatsAppConfigDto>>;

public sealed class CreateWhatsAppConfigCommandValidator
    : AbstractValidator<CreateWhatsAppConfigCommand>
{
    public CreateWhatsAppConfigCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.PhoneNumber).NotEmpty().MaximumLength(30)
            .Matches(@"^\+?\d{7,20}$").WithMessage("Enter a valid E.164 phone number.");
        RuleFor(x => x.ApiKey).NotEmpty().WithMessage("API key / access token is required.")
            .MaximumLength(2000);
        RuleFor(x => x.AppName).MaximumLength(200);
        RuleFor(x => x.BaseUrl).MaximumLength(500);
    }
}

public sealed class CreateWhatsAppConfigCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<CreateWhatsAppConfigCommand, Result<WhatsAppConfigDto>>
{
    public async Task<Result<WhatsAppConfigDto>> Handle(
        CreateWhatsAppConfigCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<WhatsAppConfigDto>("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.whatsapp.update"))
            return Result.Failure<WhatsAppConfigDto>("You don't have permission to update WhatsApp settings.");

        // Uniqueness: (TenantId, Name)
        if (await db.WhatsAppProviderConfigurations.AnyAsync(
            c => c.TenantId == tenantId && c.Name == cmd.Name, ct))
            return Result.Failure<WhatsAppConfigDto>("A config with this name already exists for this tenant.");

        var actor = currentUser.UserId == Guid.Empty ? (Guid?)null : currentUser.UserId;

        // Enforce single-active-per-scope
        if (cmd.IsActive)
        {
            var actives = await db.WhatsAppProviderConfigurations
                .Where(c => c.TenantId == tenantId && c.IsActive)
                .ToListAsync(ct);
            foreach (var a in actives) a.IsActive = false;
        }

        var row = new WhatsAppProviderConfiguration
        {
            Id          = Guid.NewGuid(),
            TenantId    = tenantId,
            Name        = cmd.Name,
            Provider    = cmd.Provider,
            PhoneNumber = cmd.PhoneNumber,
            ApiKey      = cmd.ApiKey,   // encrypted via ProtectedStringConverter
            AppName     = string.IsNullOrWhiteSpace(cmd.AppName) ? null : cmd.AppName,
            BaseUrl     = string.IsNullOrWhiteSpace(cmd.BaseUrl) ? null : cmd.BaseUrl,
            IsActive    = cmd.IsActive,
            CreatedBy   = actor,
        };
        db.WhatsAppProviderConfigurations.Add(row);
        await db.SaveChangesAsync(ct);

        return Result.Success(ToDto(row));
    }

    private static WhatsAppConfigDto ToDto(WhatsAppProviderConfiguration r) =>
        new(r.Id, r.TenantId, r.Name, r.Provider.ToString(), r.IsActive,
            !string.IsNullOrEmpty(r.ApiKey), r.PhoneNumber, r.AppName, r.BaseUrl,
            r.CreatedAt, r.UpdatedAt);
}
