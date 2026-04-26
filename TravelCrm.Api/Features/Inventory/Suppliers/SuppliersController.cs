using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TravelCrm.Api.Features.Inventory.Suppliers.Commands;
using TravelCrm.Api.Features.Inventory.Suppliers.Queries;

namespace TravelCrm.Api.Features.Inventory.Suppliers;

[ApiController]
[Authorize]
[Route("api/inventory/suppliers")]
public sealed class SuppliersController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? supplierType)
    {
        var r = await mediator.Send(new ListSuppliersQuery(supplierType));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("Tenant", StringComparison.OrdinalIgnoreCase)
            ? BadRequest(new { error = r.Error })
            : Forbid();
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var r = await mediator.Send(new GetSupplierQuery(id));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : Forbid();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SupplierWriteRequest body)
    {
        var r = await mediator.Send(new CreateSupplierCommand(
            body.Name, body.SupplierType, body.ContactName, body.ContactEmail,
            body.ContactPhone, body.Address, body.ContractValidFrom, body.ContractValidTo));
        return r.IsSuccess
            ? CreatedAtAction(nameof(Get), new { id = r.Value!.Id }, r.Value)
            : BadRequest(new { error = r.Error });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] SupplierUpdateRequest body)
    {
        var r = await mediator.Send(new UpdateSupplierCommand(
            id, body.Name, body.SupplierType, body.ContactName, body.ContactEmail,
            body.ContactPhone, body.Address, body.ContractValidFrom, body.ContractValidTo, body.IsActive));
        if (r.IsSuccess) return Ok(r.Value);
        return r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase)
            ? NotFound(new { error = r.Error })
            : BadRequest(new { error = r.Error });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var r = await mediator.Send(new DeleteSupplierCommand(id));
        if (r.IsSuccess) return NoContent();
        if (r.Error!.Contains("not found", StringComparison.OrdinalIgnoreCase))
            return NotFound(new { error = r.Error });
        if (r.Error!.Contains("in use", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { error = r.Error });
        return Forbid();
    }
}

public sealed record SupplierWriteRequest(
    string Name, string SupplierType,
    string? ContactName, string? ContactEmail, string? ContactPhone, string? Address,
    DateOnly? ContractValidFrom, DateOnly? ContractValidTo);

public sealed record SupplierUpdateRequest(
    string Name, string SupplierType,
    string? ContactName, string? ContactEmail, string? ContactPhone, string? Address,
    DateOnly? ContractValidFrom, DateOnly? ContractValidTo, bool IsActive);
