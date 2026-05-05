using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using TravelCrm.Api.Common;
using TravelCrm.Api.Infrastructure.Middleware;

namespace TravelCrm.Api.Infrastructure.Filters;

/// <summary>
/// Global MVC result filter that wraps every <see cref="ObjectResult"/> into
/// the standard <see cref="ApiEnvelope{T}"/>:
///
/// <list type="bullet">
///   <item><description>2xx → <c>{ success: true, data: … }</c></description></item>
///   <item><description>4xx / 5xx → <c>{ success: false, error: "…", errors: {…}, correlationId: "…" }</c>,
///         extracting <c>error</c> / <c>errors</c> fields from the original payload when present.</description></item>
/// </list>
///
/// Controllers remain thin — they keep calling <c>Ok(dto)</c>,
/// <c>BadRequest(new { error = "..." })</c>, etc.
/// <c>NoContent</c>, <c>FileResult</c>, and other non-object results are passed through unchanged.
/// </summary>
public sealed class ApiEnvelopeFilter : IResultFilter
{
    /// <summary>Routes whose responses must NOT be wrapped (e.g. SPA static files, Swagger, health).</summary>
    private static readonly string[] BypassPathPrefixes =
    {
        "/swagger", "/health", "/uploads"
    };

    public void OnResultExecuting(ResultExecutingContext context)
    {
        var path = context.HttpContext.Request.Path.Value ?? string.Empty;
        foreach (var p in BypassPathPrefixes)
            if (path.StartsWith(p, StringComparison.OrdinalIgnoreCase))
                return;

        if (context.Result is not ObjectResult objectResult) return;

        var status = objectResult.StatusCode ?? 200;
        var correlationId = context.HttpContext.GetCorrelationId();

        if (status is >= 200 and < 300)
        {
            // Already enveloped? Skip (defence against double-wrapping in nested filters).
            if (objectResult.Value is { } v && v.GetType().Name.StartsWith("ApiEnvelope", StringComparison.Ordinal))
                return;

            context.Result = new ObjectResult(
                new ApiEnvelope<object?>(true, objectResult.Value, null, null, null, correlationId))
            {
                StatusCode = status,
                DeclaredType = typeof(ApiEnvelope<object?>),
            };
            return;
        }

        // Failure envelope — try to extract error/errors from whatever payload the controller supplied
        var (error, errors) = ExtractError(objectResult.Value);
        context.Result = new ObjectResult(
            new ApiEnvelope<object?>(false, null, null, error, errors, correlationId))
        {
            StatusCode = status,
            DeclaredType = typeof(ApiEnvelope<object?>),
        };
    }

    public void OnResultExecuted(ResultExecutedContext context) { }

    private static (string? error, IReadOnlyDictionary<string, string[]>? errors) ExtractError(object? payload)
    {
        if (payload is null) return (null, null);

        // Anonymous object { error = "..." }
        var errorProp = payload.GetType().GetProperty("error")
                     ?? payload.GetType().GetProperty("Error");
        var errorsProp = payload.GetType().GetProperty("errors")
                      ?? payload.GetType().GetProperty("Errors");

        var err = errorProp?.GetValue(payload) as string;
        var errs = errorsProp?.GetValue(payload) as IReadOnlyDictionary<string, string[]>;

        // Fallback: treat whole payload as an error message
        if (err is null && payload is string s) err = s;

        return (err, errs);
    }
}
