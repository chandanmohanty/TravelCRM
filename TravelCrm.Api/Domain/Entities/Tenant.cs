namespace TravelCrm.Api.Domain.Entities;

public sealed class Tenant : IAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = default!;
    public string Slug { get; set; } = default!;
    public string Plan { get; set; } = "Starter";
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? Settings { get; set; }
    public string DefaultLanguage { get; set; } = "en";
    public string DefaultTimeZone { get; set; } = "UTC";
    public string DefaultCurrencyCode { get; set; } = "USD";
}
