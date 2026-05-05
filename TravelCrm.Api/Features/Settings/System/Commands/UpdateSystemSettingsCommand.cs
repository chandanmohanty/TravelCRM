using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Settings.System.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Settings.System.Commands;

public sealed record UpdateSystemSettingsCommand(
    string DateFormat,
    string TimeFormat,
    string DefaultTimeZone,
    string DefaultCurrencyCode,
    int    FiscalYearStartMonth,
    int    FiscalYearStartDay
) : IRequest<Result<SystemSettingsDto>>;

public sealed class UpdateSystemSettingsCommandValidator : AbstractValidator<UpdateSystemSettingsCommand>
{
    public UpdateSystemSettingsCommandValidator()
    {
        RuleFor(x => x.DateFormat).NotEmpty().MaximumLength(20);
        RuleFor(x => x.TimeFormat).NotEmpty().MaximumLength(20);
        RuleFor(x => x.DefaultTimeZone).NotEmpty().MaximumLength(50);
        RuleFor(x => x.DefaultCurrencyCode).NotEmpty().Length(3);
        RuleFor(x => x.FiscalYearStartMonth).InclusiveBetween(1, 12);
        RuleFor(x => x.FiscalYearStartDay).InclusiveBetween(1, 28);
    }
}

public sealed class UpdateSystemSettingsCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateSystemSettingsCommand, Result<SystemSettingsDto>>
{
    public async Task<Result<SystemSettingsDto>> Handle(UpdateSystemSettingsCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<SystemSettingsDto>("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.settings.update"))
            return Result.Failure<SystemSettingsDto>("You don't have permission to update settings.");

        var row = await db.SystemSettings.FirstOrDefaultAsync(s => s.TenantId == tenantId, ct);
        var actor = currentUser.UserId == Guid.Empty ? (Guid?)null : currentUser.UserId;

        if (row is null)
        {
            row = new SystemSettings
            {
                TenantId  = tenantId.Value,
                CreatedBy = actor,
            };
            db.SystemSettings.Add(row);
        }

        row.DateFormat           = cmd.DateFormat;
        row.TimeFormat           = cmd.TimeFormat;
        row.DefaultTimeZone      = cmd.DefaultTimeZone;
        row.DefaultCurrencyCode  = cmd.DefaultCurrencyCode.ToUpperInvariant();
        row.FiscalYearStartMonth = cmd.FiscalYearStartMonth;
        row.FiscalYearStartDay   = cmd.FiscalYearStartDay;
        row.UpdatedAt            = DateTime.UtcNow;
        row.UpdatedBy            = actor;

        await db.SaveChangesAsync(ct);

        return Result.Success(new SystemSettingsDto(
            row.DateFormat, row.TimeFormat, row.DefaultTimeZone, row.DefaultCurrencyCode,
            row.FiscalYearStartMonth, row.FiscalYearStartDay));
    }
}
