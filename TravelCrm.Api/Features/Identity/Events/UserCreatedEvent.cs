using MediatR;

namespace TravelCrm.Api.Features.Identity.Events;

/// <summary>
/// Fired after a tenant user has been successfully created. Handlers
/// are best-effort (never throw back into the creator) and may send
/// welcome emails, WhatsApp messages, etc.
/// </summary>
public sealed record UserCreatedEvent(
    Guid UserId,
    Guid TenantId,
    bool SendInvite,
    string? InviteToken,
    string? InviteUrl) : INotification;
