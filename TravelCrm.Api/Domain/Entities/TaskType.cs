namespace TravelCrm.Api.Domain.Entities;

public sealed class TaskType : BaseEntity
{
    public string Name { get; set; } = default!;
    public string Color { get; set; } = "#3B82F6";
    public bool IsActive { get; set; } = true;
}
