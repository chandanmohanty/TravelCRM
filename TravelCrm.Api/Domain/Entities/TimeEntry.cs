namespace TravelCrm.Api.Domain.Entities;

public sealed class TimeEntry : BaseEntity
{
    public Guid TaskId { get; set; }
    public Guid UserId { get; set; }
    public int Minutes { get; set; }
    public string? Notes { get; set; }
    public DateTime LoggedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public TenantTask? Task { get; set; }
}
