using FluentValidation;
using MediatR;
using TravelCrm.Api.Common;
using TravelCrm.Api.Features.Email.DTOs;
using TravelCrm.Api.Infrastructure.Email;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Email.Commands;

/// <summary>
/// Sends a test email using a specific saved email configuration.
/// The test email is a simple HTML message confirming the config works.
/// </summary>
public sealed record SendTestEmailCommand(Guid ConfigId, Guid? TenantId, string ToEmail)
    : IRequest<Result<SendTestEmailResult>>;

public sealed class SendTestEmailCommandValidator : AbstractValidator<SendTestEmailCommand>
{
    public SendTestEmailCommandValidator()
    {
        RuleFor(x => x.ToEmail).NotEmpty().EmailAddress()
            .WithMessage("A valid recipient email is required.");
    }
}

public sealed class SendTestEmailCommandHandler(
    ApplicationDbContext db,
    EmailSenderResolver resolver,
    ILogger<SendTestEmailCommandHandler> logger)
    : IRequestHandler<SendTestEmailCommand, Result<SendTestEmailResult>>
{
    public async Task<Result<SendTestEmailResult>> Handle(SendTestEmailCommand cmd, CancellationToken ct)
    {
        var config = await db.EmailConfigurations.FindAsync([cmd.ConfigId], ct);
        if (config is null)
            return Result.Failure<SendTestEmailResult>("Email configuration not found.");

        if (config.TenantId != cmd.TenantId)
            return Result.Failure<SendTestEmailResult>("Email configuration does not belong to this scope.");

        try
        {
            var sender = resolver.CreateFromConfig(config);

            var result = await sender.SendAsync(
                cmd.ToEmail,
                "TravelCRM — Test Email",
                """
                <div style="font-family: sans-serif; padding: 24px;">
                  <h2 style="color: #5D87FF;">Email Configuration Test</h2>
                  <p>This is a test email from your TravelCRM application.</p>
                  <p>If you received this, your email configuration
                     <strong>"{configName}"</strong> is working correctly.</p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                  <p style="color: #999; font-size: 12px;">
                    Provider: {provider} | Sent at: {timestamp}
                  </p>
                </div>
                """
                .Replace("{configName}", config.Name)
                .Replace("{provider}", config.Provider.ToString())
                .Replace("{timestamp}", DateTime.UtcNow.ToString("u")),
                ct);

            if (result.Success)
                logger.LogInformation("Test email sent successfully to {To} via config '{Name}'",
                    cmd.ToEmail, config.Name);
            else
                logger.LogWarning("Test email failed to {To} via config '{Name}': {Message}",
                    cmd.ToEmail, config.Name, result.Message);

            return Result.Success(new SendTestEmailResult(result.Success, result.Message));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Test email failed for config '{Name}'", config.Name);
            return Result.Success(new SendTestEmailResult(false, $"Error: {ex.Message}"));
        }
    }
}
