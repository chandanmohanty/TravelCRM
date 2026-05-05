using MediatR;
using Microsoft.EntityFrameworkCore;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Ai;
using TravelCrm.Api.Infrastructure.Identity;
using TravelCrm.Api.Infrastructure.Multitenancy;
using TravelCrm.Api.Infrastructure.Persistence;

namespace TravelCrm.Api.Features.Settings.Ai.Commands;

/// <summary>
/// Sends a minimal prompt to the configured provider to verify credentials +
/// connectivity. Returns the model's reply text on success.
/// </summary>
public sealed record TestAiProviderConfigCommand(Guid Id) : IRequest<Result<TestAiProviderResultDto>>;

public sealed record TestAiProviderResultDto(bool Success, string? Reply, string? Error);

public sealed class TestAiProviderConfigCommandHandler(
    ApplicationDbContext db,
    ITenantContext tenantContext,
    ICurrentUser currentUser,
    AiClientResolver resolver)
    : IRequestHandler<TestAiProviderConfigCommand, Result<TestAiProviderResultDto>>
{
    private const string TestPrompt = "Reply with a single word: 'pong'.";

    public async Task<Result<TestAiProviderResultDto>> Handle(
        TestAiProviderConfigCommand cmd, CancellationToken ct)
    {
        var tenantId = tenantContext.TenantId;
        if (tenantId is null) return Result.Failure<TestAiProviderResultDto>("Tenant context not resolved.");
        if (!currentUser.HasPermission("admin.ai.update"))
            return Result.Failure<TestAiProviderResultDto>(
                "You don't have permission to test AI provider settings.");

        var row = await db.AiProviderConfigurations.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == cmd.Id && c.TenantId == tenantId, ct);
        if (row is null) return Result.Failure<TestAiProviderResultDto>("AI provider config not found.");

        var client = resolver.CreateFromConfig(row);
        var result = await client.CompleteAsync(TestPrompt, ct);

        return Result.Success(new TestAiProviderResultDto(
            Success: result.Success,
            Reply:   result.Text,
            Error:   result.Error));
    }
}
