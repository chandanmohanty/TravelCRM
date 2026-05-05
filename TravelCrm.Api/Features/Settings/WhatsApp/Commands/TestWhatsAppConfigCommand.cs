using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;
using TravelCrm.Api.Infrastructure.WhatsApp;

namespace TravelCrm.Api.Features.Settings.WhatsApp.Commands;

public sealed record TestWhatsAppConfigCommand(Guid Id) : IRequest<Result<WhatsAppTestResult>>;
public sealed record WhatsAppTestResult(bool Success, string? Error);

public sealed class TestWhatsAppConfigCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    WhatsAppClientResolver resolver)
    : IRequestHandler<TestWhatsAppConfigCommand, Result<WhatsAppTestResult>>
{
    public async Task<Result<WhatsAppTestResult>> Handle(
        TestWhatsAppConfigCommand cmd, CancellationToken ct)
    {
        if (!currentUser.HasPermission("admin.whatsapp.update"))
            return Result.Failure<WhatsAppTestResult>("Insufficient permissions.");

        var tenantId = tenantContext.TenantId;
        var row = await db.WhatsAppProviderConfigurations
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == cmd.Id && c.TenantId == tenantId, ct);
        if (row is null)
            return Result.Failure<WhatsAppTestResult>("WhatsApp config not found.");

        var client = resolver.CreateFromConfig(row);
        var ping   = await client.PingAsync(ct);

        return Result.Success(new WhatsAppTestResult(ping.Success, ping.Error));
    }
}
