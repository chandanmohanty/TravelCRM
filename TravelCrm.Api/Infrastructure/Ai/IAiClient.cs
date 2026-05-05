using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Infrastructure.Ai;

/// <summary>
/// Abstraction over the LLM providers the app can talk to. Kept deliberately
/// thin — just enough to power tenant-admin "Test Connection" + future prompt
/// calls. Providers are constructed from an <see cref="AiProviderConfiguration"/>
/// row and use named <see cref="IHttpClientFactory"/> clients so retries,
/// timeouts, and logging are centrally configured.
/// </summary>
public interface IAiClient
{
    AiProvider Provider { get; }

    /// <summary>Returns the model's reply as plain text (first content block only).</summary>
    Task<AiCompletionResult> CompleteAsync(string prompt, CancellationToken ct = default);
}

public sealed record AiCompletionResult(bool Success, string? Text, string? Error);
