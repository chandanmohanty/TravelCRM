namespace TravelCrm.Api.Domain.Entities;

public sealed class TenantTask : BaseEntity
{
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public TaskStatus Status { get; set; } = TaskStatus.ToDo;
    public TaskPriority Priority { get; set; } = TaskPriority.Medium;
    public Guid? TaskTypeId { get; set; }
    public Guid? AssignedToUserId { get; set; }
    public Guid CreatedByUserId { get; set; }
    public Guid? ParentTaskId { get; set; }
    public DateTime? DueDate { get; set; }
    public int? EstimatedMinutes { get; set; }
    public bool IsDeleted { get; set; }
    public bool IsOverdueSent { get; set; }

    // Navigation properties
    public TaskType? TaskType { get; set; }
    public TenantTask? Parent { get; set; }
    public ICollection<TenantTask> Children { get; set; } = new List<TenantTask>();
    public ICollection<TimeEntry> TimeEntries { get; set; } = new List<TimeEntry>();
}
