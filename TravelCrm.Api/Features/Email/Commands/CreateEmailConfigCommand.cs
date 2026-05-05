using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Email.DTOs;
using TravelCrm.Api.Features.Email.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Email.Commands;

public sealed record CreateEmailConfigCommand(
    Guid?          TenantId,
    string         Name,
    EmailProvider  Provider,
    bool           IsActive,
    string?        SmtpHost,
    int?           SmtpPort,
    string?        Username,
    string?        Password,
    bool?          EnableSsl,
    string         SenderEmail,
    string         SenderName,
    string?        ApiKey,
    string?        ApiDomain,
    string?        AwsRegion)
    : IRequest<Result<EmailConfigDto>>;

public sealed class CreateEmailConfigCommandValidator : AbstractValidator<CreateEmailConfigCommand>
{
    public CreateEmailConfigCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Provider).IsInEnum();
        RuleFor(x => x.SenderEmail).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.SenderName).NotEmpty().MaximumLength(200);

        // SMTP providers require credentials
        When(x => x.Provider is EmailProvider.Smtp or EmailProvider.Office365
                   or EmailProvider.Outlook or EmailProvider.Gmail
                   or EmailProvider.Exchange or EmailProvider.AmazonSes, () =>
        {
            RuleFor(x => x.Username).NotEmpty().WithMessage("Username is required for SMTP.");
            RuleFor(x => x.Password).NotEmpty().WithMessage("Password is required for SMTP.");
        });

        // API providers require API key
        When(x => x.Provider is EmailProvider.SendGridApi, () =>
        {
            RuleFor(x => x.ApiKey).NotEmpty().WithMessage("API key is required for SendGrid.");
        });

        When(x => x.Provider is EmailProvider.MailgunApi, () =>
        {
            RuleFor(x => x.ApiKey).NotEmpty().WithMessage("API key is required for Mailgun.");
            RuleFor(x => x.ApiDomain).NotEmpty().WithMessage("Sending domain is required for Mailgun.");
        });

        When(x => x.Provider is EmailProvider.AmazonSes, () =>
        {
            RuleFor(x => x.AwsRegion).NotEmpty().WithMessage("AWS Region is required for SES.");
        });
    }
}

public sealed class CreateEmailConfigCommandHandler(
    ApplicationDbContext db,
    ICurrentUser currentUser,
    ILogger<CreateEmailConfigCommandHandler> logger)
    : IRequestHandler<CreateEmailConfigCommand, Result<EmailConfigDto>>
{
    public async Task<Result<EmailConfigDto>> Handle(CreateEmailConfigCommand cmd, CancellationToken ct)
    {
        var nameExists = await db.EmailConfigurations
            .AnyAsync(c => c.TenantId == cmd.TenantId && c.Name == cmd.Name, ct);
        if (nameExists)
            return Result.Failure<EmailConfigDto>($"An email configuration named '{cmd.Name}' already exists.");

        if (cmd.IsActive)
        {
            var activeConfigs = await db.EmailConfigurations
                .Where(c => c.TenantId == cmd.TenantId && c.IsActive)
                .ToListAsync(ct);
            foreach (var c in activeConfigs) c.IsActive = false;
        }

        var userId = currentUser.UserId == Guid.Empty ? (Guid?)null : currentUser.UserId;
        var row = new EmailConfiguration
        {
            Id           = Guid.NewGuid(),
            TenantId     = cmd.TenantId,
            Name         = cmd.Name,
            Provider     = cmd.Provider,
            IsActive     = cmd.IsActive,
            SmtpHost     = cmd.SmtpHost,
            SmtpPort     = cmd.SmtpPort ?? 587,
            Username     = cmd.Username,
            Password     = cmd.Password,
            EnableSsl    = cmd.EnableSsl ?? true,
            SenderEmail  = cmd.SenderEmail,
            SenderName   = cmd.SenderName,
            ApiKey       = cmd.ApiKey,
            ApiDomain    = cmd.ApiDomain,
            AwsRegion    = cmd.AwsRegion,
            CreatedAt    = DateTime.UtcNow,
            CreatedBy    = userId
        };

        db.EmailConfigurations.Add(row);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Email config '{Name}' (provider={Provider}) created for scope {Scope}",
            row.Name, row.Provider, row.TenantId?.ToString() ?? "platform");

        return Result.Success(GetEmailConfigsQueryHandler.ToMaskedDto(row));
    }
}
