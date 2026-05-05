namespace TravelCrm.Api.Domain.Entities;

public sealed class Notification : BaseEntity
{
    public Guid UserId { get; set; }
    public string Type { get; set; } = default!;
    public string Title { get; set; } = default!;
    public string Message { get; set; } = default!;
    public bool IsRead { get; set; }
    public string? ActionUrl { get; set; }
    public string? Data { get; set; }
}
