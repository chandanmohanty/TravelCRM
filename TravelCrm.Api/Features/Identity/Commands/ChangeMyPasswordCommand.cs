using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Identity;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;

namespace TravelCrm.Api.Features.Identity.Commands;

public sealed record ChangeMyPasswordCommand(string CurrentPassword, string NewPassword)
    : IRequest<Result>;

public sealed class ChangeMyPasswordCommandValidator : AbstractValidator<ChangeMyPasswordCommand>
{
    public ChangeMyPasswordCommandValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty();
        RuleFor(x => x.NewPassword)
            .NotEmpty().MinimumLength(8)
            .Matches("[A-Z]").WithMessage("Password must contain an uppercase letter.")
            .Matches("[a-z]").WithMessage("Password must contain a lowercase letter.")
            .Matches(@"\d").WithMessage("Password must contain a digit.");
    }
}

public sealed class ChangeMyPasswordCommandHandler(
    UserManager<ApplicationUser> userManager,
    ICurrentUser currentUser,
    ILogger<ChangeMyPasswordCommandHandler> logger)
    : IRequestHandler<ChangeMyPasswordCommand, Result>
{
    public async Task<Result> Handle(ChangeMyPasswordCommand cmd, CancellationToken ct)
    {
        if (!currentUser.IsAuthenticated)
            return Result.Failure("Not authenticated.");

        var me = await userManager.FindByIdAsync(currentUser.UserId.ToString());
        if (me is null) return Result.Failure("User not found.");

        var result = await userManager.ChangePasswordAsync(me, cmd.CurrentPassword, cmd.NewPassword);
        if (!result.Succeeded)
            return Result.Failure(string.Join("; ", result.Errors.Select(e => e.Description)));

        logger.LogInformation("Password changed by user {UserId}", me.Id);
        return Result.Success();
    }
}
