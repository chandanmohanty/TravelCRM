using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Commands;

public sealed record UpdateMyProfileCommand(
    string  FirstName,
    string  LastName,
    string? Phone,
    string? JobTitle,
    string? PreferredLanguage,
    string? TimeZone,
    string? CurrencyCode) : IRequest<Result>;

public sealed class UpdateMyProfileCommandValidator : AbstractValidator<UpdateMyProfileCommand>
{
    public UpdateMyProfileCommandValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Phone).MaximumLength(50);
        RuleFor(x => x.JobTitle).MaximumLength(100);
        RuleFor(x => x.PreferredLanguage).MaximumLength(10);
        RuleFor(x => x.TimeZone).MaximumLength(50);
        RuleFor(x => x.CurrencyCode).MaximumLength(5);
    }
}

public sealed class UpdateMyProfileCommandHandler(
    ApplicationDbContext db,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateMyProfileCommand, Result>
{
    public async Task<Result> Handle(UpdateMyProfileCommand cmd, CancellationToken ct)
    {
        if (!currentUser.IsAuthenticated)
            return Result.Failure("Not authenticated.");

        var me = await db.Users.FirstOrDefaultAsync(u => u.Id == currentUser.UserId && !u.IsDeleted, ct);
        if (me is null) return Result.Failure("User not found.");

        me.FirstName         = cmd.FirstName;
        me.LastName          = cmd.LastName;
        me.PhoneNumber       = cmd.Phone;
        me.JobTitle          = cmd.JobTitle;
        me.PreferredLanguage = cmd.PreferredLanguage ?? me.PreferredLanguage;
        me.TimeZone          = cmd.TimeZone          ?? me.TimeZone;
        me.CurrencyCode      = cmd.CurrencyCode      ?? me.CurrencyCode;
        me.UpdatedAt         = DateTime.UtcNow;
        me.UpdatedBy         = me.Id;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
