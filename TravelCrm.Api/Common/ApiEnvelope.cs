using System.Text.Json.Serialization;

namespace TravelCrm.Api.Common;

/// <summary>
/// Standard response envelope returned by every endpoint.
///
/// Success: <c>{ "success": true, "data": ..., "meta": ... }</c>
/// Failure: <c>{ "success": false, "error": "Human readable", "errors": { field: [msg] },
///               "correlationId": "abc123" }</c>
///
/// Apply via <see cref="Filters.ApiEnvelopeFilter"/> — controllers still call
/// <c>Ok(x)</c> and <c>BadRequest(new { error })</c> as before; the filter
/// rewrites the outgoing payload into the envelope.
/// </summary>
public sealed record ApiEnvelope<T>(
    [property: JsonPropertyName("success")] bool Success,
    [property: JsonPropertyName("data")]    T?   Data,
    [property: JsonPropertyName("meta")]    object? Meta          = null,
    [property: JsonPropertyName("error")]   string? Error         = null,
    [property: JsonPropertyName("errors")]  IReadOnlyDictionary<string, string[]>? Errors = null,
    [property: JsonPropertyName("correlationId")] string? CorrelationId = null);
