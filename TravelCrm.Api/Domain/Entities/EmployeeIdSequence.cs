namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// Per-tenant per-year monotonic counter used to allocate Employee IDs
/// (<c>EMP-{YYYY}-{6-digit}</c>). Composite PK (TenantId, Year). Concurrency
/// is handled at SQL level via <c>INSERT … ON CONFLICT DO UPDATE RETURNING</c>
/// in <c>EmployeeIdGenerator</c> — no row-version token needed.
/// </summary>
public sealed class EmployeeIdSequence
{
    public Guid TenantId { get; set; }
    public int  Year     { get; set; }

    /// <summary>Next sequence value to allocate (1-based). The generator
    /// atomically returns the current value and increments <c>NextValue</c>.</summary>
    public int  NextValue { get; set; } = 1;
}
