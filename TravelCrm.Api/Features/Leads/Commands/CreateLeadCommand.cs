using FluentValidation;
using MediatR;
using TravelCrm.Api.Common;
using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Leads.DTOs;
using TravelCrm.Api.Features.Leads.Queries;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Leads.Commands;

public sealed record CreateLeadCommand(
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

public sealed class CreateLeadCommandValidator : AbstractValidator<CreateLeadCommand>
{
    public CreateLeadCommandValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Score).InclusiveBetween(0, 100);
        RuleFor(x => x.EstimatedValue).GreaterThanOrEqualTo(0).When(x => x.EstimatedValue.HasValue);
    }
}

public sealed class CreateLeadCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser)
    : IRequestHandler<CreateLeadCommand, Result<LeadDto>>
{
    public async Task<Result<LeadDto>> Handle(CreateLeadCommand cmd, CancellationToken ct)
    {
        if (!tenantContext.IsResolved) return Result.Failure<LeadDto>("Tenant context not resolved.");
        if (!currentUser.HasPermission("crm.leads.manage"))
            return Result.Failure<LeadDto>("You don't have permission to manage leads.");

        var row = new Lead
        {
            Id             = Guid.NewGuid(),
            TenantId       = tenantContext.TenantId!.Value,
            FirstName      = cmd.FirstName,
            LastName       = cmd.LastName,
            Email          = cmd.Email,
            Phone          = cmd.Phone ?? string.Empty,
            Company        = cmd.Company ?? string.Empty,
            JobTitle       = cmd.JobTitle ?? string.Empty,
            Status         = cmd.Status,
            Source         = cmd.Source,
            Score          = cmd.Score,
            AssignedTo     = cmd.AssignedTo ?? string.Empty,
            Tags           = cmd.Tags?.ToList() ?? new(),
            Notes          = cmd.Notes ?? string.Empty,
            EstimatedValue = cmd.EstimatedValue,
            CreatedAt      = DateTime.UtcNow,
            CreatedBy      = currentUser.UserId == Guid.Empty ? (Guid?)null : currentUser.UserId,
        };

        db.Leads.Add(row);
        await db.SaveChangesAsync(ct);
        return Result.Success(LeadMapper.ToDto(row));
    }
}
