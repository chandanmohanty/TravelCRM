namespace TravelCrm.Api.Domain.Entities;

public enum LeadStatus
{
    New         = 1,
    Contacted   = 2,
    Qualified   = 3,
    Unqualified = 4,
    [Obsolete("Retired in Phase 1. Use a Deal to express conversion. Existing rows are backfilled to Qualified.")]
    Converted   = 5,
}

public enum LeadSource
{
    Website       = 1,
    Referral      = 2,
    SocialMedia   = 3,
    EmailCampaign = 4,
    TradeShow     = 5,
    ColdCall      = 6,
    Partner       = 7,
    Other         = 8,
}

public sealed class Lead : IAuditableEntity
{
    public Guid         Id             { get; set; } = Guid.NewGuid();
    public Guid         TenantId       { get; set; }
    public string       FirstName      { get; set; } = string.Empty;
    public string       LastName       { get; set; } = string.Empty;
    public string       Email          { get; set; } = string.Empty;
    public string       Phone          { get; set; } = string.Empty;
    public string       Company        { get; set; } = string.Empty;
    public string       JobTitle       { get; set; } = string.Empty;
    public LeadStatus   Status         { get; set; } = LeadStatus.New;
    public LeadSource   Source         { get; set; } = LeadSource.Other;
    public int          Score          { get; set; }
    public string       AssignedTo     { get; set; } = string.Empty;
    public List<string> Tags           { get; set; } = new();
    public string       Notes          { get; set; } = string.Empty;
    public decimal?     EstimatedValue { get; set; }
    public DateTime     CreatedAt      { get; set; } = DateTime.UtcNow;
    public DateTime?    UpdatedAt      { get; set; }
    public Guid?        CreatedBy      { get; set; }
    public Guid?        UpdatedBy      { get; set; }
}
