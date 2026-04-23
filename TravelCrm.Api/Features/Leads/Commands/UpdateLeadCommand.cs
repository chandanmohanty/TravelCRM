using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Leads.DTOs;
using TravelCrm.Api.Features.Leads.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Leads.Commands;

public sealed record UpdateLeadCommand(
    Guid                Id,
    string              FirstName,
    string              LastName,
    string              Email,
    string              Phone,
    string              Company,
    string              JobTitle,
    LeadStatus          Status,
    LeadSource          Source,
    int                 Score,
    string              AssignedTo,
    IEnumerable<string> Tags,
    string              Notes,
    decimal?            EstimatedValue
) : IRequest<Result<LeadDto>>;

public sealed class UpdateLeadCommandValidator : AbstractValidator<UpdateLeadCommand>
{
    public UpdateLeadCommandValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Score).InclusiveBetween(0, 100);
        RuleFor(x => x.EstimatedValue).GreaterThanOrEqualTo(0).When(x => x.EstimatedValue.HasValue);
    }
}

public sealed class UpdateLeadCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateLeadCommand, Result<LeadDto>>
{
    public async Task<Result<LeadDto>> Handle(UpdateLeadCommand cmd, CancellationToken ct)
    {
        if (!tenantContext.IsResolved) return Result.Failure<LeadDto>("Tenant context not resolved.");
        if (!currentUser.HasPermission("crm.leads.manage"))
            return Result.Failure<LeadDto>("You don't have permission to manage leads.");

        var row = await db.Leads
            .FirstOrDefaultAsync(l => l.Id == cmd.Id && l.TenantId == tenantContext.TenantId!.Value, ct);
        if (row is null) return Result.Failure<LeadDto>("Lead not found.");

        row.FirstName      = cmd.FirstName;
        row.LastName       = cmd.LastName;
        row.Email          = cmd.Email;
        row.Phone          = cmd.Phone ?? string.Empty;
        row.Company        = cmd.Company ?? string.Empty;
        row.JobTitle       = cmd.JobTitle ?? string.Empty;
        row.Status         = cmd.Status;
        row.Source         = cmd.Source;
        row.Score          = cmd.Score;
        row.AssignedTo     = cmd.AssignedTo ?? string.Empty;
        row.Tags           = cmd.Tags?.ToList() ?? new();
        row.Notes          = cmd.Notes ?? string.Empty;
        row.EstimatedValue = cmd.EstimatedValue;
        row.UpdatedAt      = DateTime.UtcNow;
        row.UpdatedBy      = currentUser.UserId == Guid.Empty ? (Guid?)null : currentUser.UserId;

        await db.SaveChangesAsync(ct);
        return Result.Success(LeadMapper.ToDto(row));
    }
}
