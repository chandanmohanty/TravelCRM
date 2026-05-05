using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Identity;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;

namespace TravelCrm.Api.Features.Identity.Commands;

/// <summary>
/// Consumes a reset token and sets a new password. Public endpoint —
/// driven by the link from the forgot-password / invite flow.
/// </summary>
public sealed record ResetPasswordCommand(Guid Uid, string Token, string NewPassword)
    : IRequest<Result>;

public sealed class ResetPasswordCommandValidator : AbstractValidator<ResetPasswordCommand>
{
    public ResetPasswordCommandValidator()
    {
        RuleFor(x => x.Uid).NotEmpty();
        RuleFor(x => x.Token).NotEmpty();
        RuleFor(x => x.NewPassword)
            .NotEmpty().MinimumLength(8)
            .Matches("[A-Z]").WithMessage("Password must contain an uppercase letter.")
            .Matches("[a-z]").WithMessage("Password must contain a lowercase letter.")
            .Matches(@"\d").WithMessage("Password must contain a digit.");
    }
}

public sealed class ResetPasswordCommandHandler(
    UserManager<ApplicationUser> userManager,
    PasswordResetTokenService tokens,
    ILogger<ResetPasswordCommandHandler> logger)
    : IRequestHandler<ResetPasswordCommand, Result>
{
    public async Task<Result> Handle(ResetPasswordCommand cmd, CancellationToken ct)
    {
        var (ok, error, userId) = await tokens.ConsumeAsync(cmd.Uid, cmd.Token, ct);
        if (!ok) return Result.Failure(error!);

        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null) return Result.Failure("User no longer exists.");

        var removeResult = await userManager.RemovePasswordAsync(user);
        if (!removeResult.Succeeded)
            return Result.Failure(string.Join("; ", removeResult.Errors.Select(e => e.Description)));

        var addResult = await userManager.AddPasswordAsync(user, cmd.NewPassword);
        if (!addResult.Succeeded)
            return Result.Failure(string.Join("; ", addResult.Errors.Select(e => e.Description)));

        // If this reset came from the invite flow, activate the account
        if (user.Status == UserStatus.PendingInvitation)
            user.Status = UserStatus.Active;
        user.EmailConfirmed = true;
        user.UpdatedAt = DateTime.UtcNow;
        await userManager.UpdateAsync(user);

        logger.LogInformation("Password reset completed for user {UserId}", user.Id);
        return Result.Success();
    }
}
