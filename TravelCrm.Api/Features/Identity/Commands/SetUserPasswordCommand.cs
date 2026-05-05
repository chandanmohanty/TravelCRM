using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Identity.Commands;

public sealed record SetUserPasswordCommand(Guid UserId, string NewPassword) : IRequest<Result>;

public sealed class SetUserPasswordCommandValidator : AbstractValidator<SetUserPasswordCommand>
{
    public SetUserPasswordCommandValidator()
    {
        RuleFor(x => x.NewPassword)
            .NotEmpty().MinimumLength(8)
            .Matches("[A-Z]").WithMessage("Password must contain an uppercase letter.")
            .Matches("[a-z]").WithMessage("Password must contain a lowercase letter.")
            .Matches(@"\d").WithMessage("Password must contain a digit.");
    }
}

public sealed class SetUserPasswordCommandHandler(
    ApplicationDbContext db,
    UserManager<ApplicationUser> userManager,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    ILogger<SetUserPasswordCommandHandler> logger)
    : IRequestHandler<SetUserPasswordCommand, Result>
{
    public async Task<Result> Handle(SetUserPasswordCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.users.reset_password"))
            return Result.Failure("You don't have permission to set user passwords.");

        var user = await db.Users.FirstOrDefaultAsync(u =>
            u.Id == cmd.UserId && u.TenantId == tenantId && !u.IsDeleted, ct);
        if (user is null) return Result.Failure("User not found.");

        var removeResult = await userManager.RemovePasswordAsync(user);
        if (!removeResult.Succeeded)
            return Result.Failure(string.Join("; ", removeResult.Errors.Select(e => e.Description)));

        var addResult = await userManager.AddPasswordAsync(user, cmd.NewPassword);
        if (!addResult.Succeeded)
            return Result.Failure(string.Join("; ", addResult.Errors.Select(e => e.Description)));

        user.UpdatedAt = DateTime.UtcNow;
        user.UpdatedBy = currentUser.UserId == Guid.Empty ? null : currentUser.UserId;
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Password reset admin-initiated for user {UserId}", user.Id);
        return Result.Success();
    }
}
