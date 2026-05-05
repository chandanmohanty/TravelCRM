using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Storage.DTOs;

namespace TravelCrm.Api.Features.Email.DTOs;

// ── Response DTO ─────────────────────────────────────────────────────────────

public sealed record EmailConfigDto(
    Guid           Id,
    Guid?          TenantId,
    string         Name,
    EmailProvider  Provider,
    bool           IsActive,
    // SMTP
    string?        SmtpHost,
    int            SmtpPort,
    string?        Username,
    string?        Password,       // MASKED
    bool           EnableSsl,
    // Sender
    string         SenderEmail,
    string         SenderName,
    // API
    string?        ApiKey,          // MASKED
    string?        ApiDomain,
    string?        AwsRegion,
    // Audit
    DateTime       CreatedAt,
    DateTime?      UpdatedAt);

// ── Request DTOs ─────────────────────────────────────────────────────────────

public sealed record CreateEmailConfigRequest(
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
    string?        AwsRegion);

public sealed record UpdateEmailConfigRequest(
    string         Name,
    EmailProvider  Provider,
    bool           IsActive,
    string?        SmtpHost,
    int?           SmtpPort,
    string?        Username,
    string?        Password,       // "***..." = keep existing
    bool?          EnableSsl,
    string         SenderEmail,
    string         SenderName,
    string?        ApiKey,          // "***..." = keep existing
    string?        ApiDomain,
    string?        AwsRegion);

/// <summary>Request body for sending a test email.</summary>
public sealed record SendTestEmailRequest(string ToEmail);

/// <summary>Response from a test email send attempt.</summary>
public sealed record SendTestEmailResult(bool Success, string Message);
