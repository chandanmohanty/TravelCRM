using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Infrastructure.Identity;

/// <summary>
/// Records user-facing Identity activity events (explicit writes from handlers
/// per rule 8 — distinct from the automatic <see cref="AuditLog"/> capture).
/// Always best-effort: enqueues a row inside the caller's DbContext; the row
/// is saved when the caller calls <c>SaveChangesAsync</c>.
/// </summary>
public interface IIdentityActivityWriter
{
    void Record(
        Guid subjectUserId,
        string activityType,
        string description,
        object? metadata = null);
}

public sealed class IdentityActivityWriter(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser) : IIdentityActivityWriter
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = false };

    public void Record(
        Guid subjectUserId,
        string activityType,
        string description,
        object? metadata = null)
    {
        db.IdentityActivities.Add(new IdentityActivity
        {
            Id            = Guid.NewGuid(),
            TenantId      = tenantContext.TenantId,
            SubjectUserId = subjectUserId,
            ActorUserId   = currentUser.UserId == Guid.Empty ? null : currentUser.UserId,
            ActorName     = currentUser.Email,
            ActivityType  = activityType,
            Description   = description,
            Metadata      = metadata is null ? null : JsonSerializer.Serialize(metadata, JsonOptions),
            CreatedAt     = DateTime.UtcNow,
        });
    }
}
