using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Email.DTOs;
using TravelCrm.Api.Features.Email.Queries;
using TravelCrm.Api.Features.Storage.DTOs;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Email.Commands;

public sealed record UpdateEmailConfigCommand(
    Guid           Id,
    Guid?          TenantId,
    string         Name,
    EmailProvider  Provider,
    bool           IsActive,
    string?        SmtpHost,
    int?           SmtpPort,
    string?        Username,
    string?        Password,        // "***..." = keep existing
    bool?          EnableSsl,
    string         SenderEmail,
    string         SenderName,
    string?        ApiKey,           // "***..." = keep existing
    string?        ApiDomain,
    string?        AwsRegion)
    : IRequest<Result<EmailConfigDto>>;

public sealed class UpdateEmailConfigCommandValidator : AbstractValidator<UpdateEmailConfigCommand>
{
    public UpdateEmailConfigCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Provider).IsInEnum();
        RuleFor(x => x.SenderEmail).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.SenderName).NotEmpty().MaximumLength(200);

        When(x => x.Provider is EmailProvider.Smtp or EmailProvider.Office365
                   or EmailProvider.Outlook or EmailProvider.Gmail
                   or EmailProvider.Exchange or EmailProvider.AmazonSes, () =>
        {
            RuleFor(x => x.Username).NotEmpty();
            RuleFor(x => x.Password).NotEmpty(); // can be "***..." to keep existing
        });

        When(x => x.Provider is EmailProvider.SendGridApi, () =>
        {
            RuleFor(x => x.ApiKey).NotEmpty();
        });

        When(x => x.Provider is EmailProvider.MailgunApi, () =>
        {
            RuleFor(x => x.ApiKey).NotEmpty();
            RuleFor(x => x.ApiDomain).NotEmpty();
        });
    }
}

public sealed class UpdateEmailConfigCommandHandler(
    ApplicationDbContext db,
    ICurrentUser currentUser,
    ILogger<UpdateEmailConfigCommandHandler> logger)
    : IRequestHandler<UpdateEmailConfigCommand, Result<EmailConfigDto>>
{
    public async Task<Result<EmailConfigDto>> Handle(UpdateEmailConfigCommand cmd, CancellationToken ct)
    {
        var row = await db.EmailConfigurations.FindAsync([cmd.Id], ct);
        if (row is null)
            return Result.Failure<EmailConfigDto>("Email configuration not found.");

        if (row.TenantId != cmd.TenantId)
            return Result.Failure<EmailConfigDto>("Email configuration does not belong to this scope.");

        var nameTaken = await db.EmailConfigurations
            .AnyAsync(c => c.TenantId == cmd.TenantId && c.Name == cmd.Name && c.Id != cmd.Id, ct);
        if (nameTaken)
            return Result.Failure<EmailConfigDto>($"Name '{cmd.Name}' is already taken.");

        if (cmd.IsActive && !row.IsActive)
        {
            var others = await db.EmailConfigurations
                .Where(c => c.TenantId == cmd.TenantId && c.IsActive && c.Id != cmd.Id)
                .ToListAsync(ct);
            foreach (var o in others) o.IsActive = false;
        }

        var userId = currentUser.UserId == Guid.Empty ? (Guid?)null : currentUser.UserId;

        row.Name        = cmd.Name;
        row.Provider    = cmd.Provider;
        row.IsActive    = cmd.IsActive;
        row.SmtpHost    = cmd.SmtpHost;
        row.SmtpPort    = cmd.SmtpPort ?? row.SmtpPort;
        row.Username    = cmd.Username;
        row.Password    = CredentialMask.Resolve(cmd.Password, row.Password);
        row.EnableSsl   = cmd.EnableSsl ?? row.EnableSsl;
        row.SenderEmail = cmd.SenderEmail;
        row.SenderName  = cmd.SenderName;
        row.ApiKey      = CredentialMask.Resolve(cmd.ApiKey, row.ApiKey);
        row.ApiDomain   = cmd.ApiDomain;
        row.AwsRegion   = cmd.AwsRegion;
        row.UpdatedAt   = DateTime.UtcNow;
        row.UpdatedBy   = userId;

        await db.SaveChangesAsync(ct);

        logger.LogInformation("Email config '{Name}' updated for scope {Scope}",
            row.Name, row.TenantId?.ToString() ?? "platform");

        return Result.Success(GetEmailConfigsQueryHandler.ToMaskedDto(row));
    }
}
