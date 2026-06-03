namespace TravelCrm.Api.Domain.Entities.Crm;

/// <summary>
/// Per-tenant refresh token for the platform Google app. RefreshToken is
/// encrypted at rest via ProtectedStringConverter (configured in Task 3,
/// same pattern as AiProviderConfiguration.ApiKey). Unique on TenantId.
/// </summary>
public sealed class GoogleOAuthToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    /// <summary>SENSITIVE — encrypted at rest. Nullable to align with the
    /// ProtectedStringConverter signature (same pattern as AiProviderConfiguration.ApiKey).
    /// In practice always populated when a tenant has connected Google.</summary>
    public string? RefreshToken { get; set; }
    public string GrantedScopes { get; set; } = string.Empty;
    public Guid ConnectedByUserId { get; set; }
    public DateTime ConnectedAt { get; set; } = DateTime.UtcNow;
}
