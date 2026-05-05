using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Commands;

/// <summary>
/// Updates the caller's own locale preferences (language / timezone / currency).
/// </summary>
public sealed record UpdateUserLocaleCommand(
    string? Language,
    string? TimeZone,
    string? CurrencyCode
) : IRequest<Result>;

public sealed class UpdateUserLocaleCommandHandler(
    ApplicationDbContext db,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateUserLocaleCommand, Result>
{
    public async Task<Result> Handle(UpdateUserLocaleCommand cmd, CancellationToken ct)
    {
        if (!currentUser.IsAuthenticated)
            return Result.Failure("Not authenticated.");

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == currentUser.UserId, ct);
        if (user is null) return Result.Failure("User not found.");

        if (!string.IsNullOrEmpty(cmd.Language))     user.PreferredLanguage = cmd.Language;
        if (!string.IsNullOrEmpty(cmd.TimeZone))     user.TimeZone          = cmd.TimeZone;
        if (!string.IsNullOrEmpty(cmd.CurrencyCode)) user.CurrencyCode      = cmd.CurrencyCode;

        user.UpdatedAt = DateTime.UtcNow;
        user.UpdatedBy = currentUser.UserId;

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
