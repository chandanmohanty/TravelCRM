namespace TravelCrm.Api.Features.Leads.DTOs;

public sealed record LeadDto(
    Guid                  Id,
    Guid                  TenantId,
    string                FirstName,
    string                LastName,
    string                Email,
    string                Phone,
    string                Company,
    string                JobTitle,
    string                Status,
    string                Source,
    int                   Score,
    string                AssignedTo,
    IReadOnlyList<string> Tags,
    string                Notes,
    decimal?              EstimatedValue,
    DateTime              CreatedAt,
    DateTime?             UpdatedAt,
    int                   DealCount = 0
);
