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

/// <summary>
/// Updates an existing WhatsApp provider config.
/// <see cref="ApiKey"/> is optional — null/empty means "keep the existing key".
/// </summary>
public sealed record UpdateWhatsAppConfigCommand(
    Guid            Id,
    string          Name,
    WhatsAppProvider Provider,
    string          PhoneNumber,
    string?         ApiKey,
    string?         AppName,
    string?         BaseUrl,
    bool            IsActive
) : IRequest<Result<WhatsAppConfigDto>>;

public sealed class UpdateWhatsAppConfigCommandValidator
    : AbstractValidator<UpdateWhatsAppConfigCommand>
{
    public UpdateWhatsAppConfigCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.PhoneNumber).NotEmpty().MaximumLength(30)
            .Matches(@"^\+?\d{7,20}$").WithMessage("Enter a valid E.164 phone number.");
        RuleFor(x => x.ApiKey).MaximumLength(2000);
        RuleFor(x => x.AppName).MaximumLength(200);
        RuleFor(x => x.BaseUrl).MaximumLength(500);
    }
}

public sealed class UpdateWhatsAppConfigCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateWhatsAppConfigCommand, Result<WhatsAppConfigDto>>
{
    public async Task<Result<WhatsAppConfigDto>> Handle(
        UpdateWhatsAppConfigCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<WhatsAppConfigDto>("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.whatsapp.update"))
            return Result.Failure<WhatsAppConfigDto>("You don't have permission to update WhatsApp settings.");

        var row = await db.WhatsAppProviderConfigurations
            .FirstOrDefaultAsync(c => c.Id == cmd.Id && c.TenantId == tenantId, ct);
        if (row is null) return Result.Failure<WhatsAppConfigDto>("WhatsApp config not found.");

        // Name uniqueness (excluding self)
        if (await db.WhatsAppProviderConfigurations.AnyAsync(
            c => c.TenantId == tenantId && c.Name == cmd.Name && c.Id != cmd.Id, ct))
            return Result.Failure<WhatsAppConfigDto>("Another config with this name already exists for this tenant.");

        // Deactivate siblings when making this one active
        if (cmd.IsActive && !row.IsActive)
        {
            var actives = await db.WhatsAppProviderConfigurations
                .Where(c => c.TenantId == tenantId && c.IsActive && c.Id != cmd.Id)
                .ToListAsync(ct);
            foreach (var a in actives) a.IsActive = false;
        }

        row.Name        = cmd.Name;
        row.Provider    = cmd.Provider;
        row.PhoneNumber = cmd.PhoneNumber;
        // Rotate the key only when a non-empty value is supplied
        if (!string.IsNullOrWhiteSpace(cmd.ApiKey)) row.ApiKey = cmd.ApiKey;
        row.AppName     = string.IsNullOrWhiteSpace(cmd.AppName) ? null : cmd.AppName;
        row.BaseUrl     = string.IsNullOrWhiteSpace(cmd.BaseUrl) ? null : cmd.BaseUrl;
        row.IsActive    = cmd.IsActive;
        row.UpdatedAt   = DateTime.UtcNow;
        row.UpdatedBy   = currentUser.UserId == Guid.Empty ? null : currentUser.UserId;

        await db.SaveChangesAsync(ct);

        return Result.Success(new WhatsAppConfigDto(
            row.Id, row.TenantId, row.Name, row.Provider.ToString(), row.IsActive,
            !string.IsNullOrEmpty(row.ApiKey),
            row.PhoneNumber, row.AppName, row.BaseUrl,
            row.CreatedAt, row.UpdatedAt));
    }
}
