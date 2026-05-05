namespace TravelCrm.Api.Domain.Entities;

/// <summary>
/// Marker interface opting an entity into automatic audit-log capture.
/// The <see cref="Infrastructure.Persistence.AuditSaveChangesInterceptor"/>
/// writes a row to <c>audit_logs</c> for every Insert/Update/Delete on any
/// entity implementing this marker.
///
/// Only add this to domain-level entities where user actions matter —
/// there's no value auditing refresh-token churn or sequence counters.
/// </summary>
public interface IAuditableEntity
{
}
