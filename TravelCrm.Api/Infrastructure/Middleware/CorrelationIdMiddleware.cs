using Serilog.Context;

namespace TravelCrm.Api.Infrastructure.Middleware;

/// <summary>
/// Emits and/or propagates a <c>X-Correlation-Id</c> header on every request
/// and pushes it onto the Serilog <see cref="LogContext"/> so every log line
/// during the request carries a stable <c>CorrelationId</c> property.
///
/// Incoming value from the client is trusted when present, bounded to a safe
/// length, so upstream services (load balancer, API gateway) can propagate
/// their own IDs end-to-end. Otherwise a short GUID is minted.
/// </summary>
public sealed class CorrelationIdMiddleware(RequestDelegate next)
{
    public const string HeaderName = "X-Correlation-Id";
    private const int MaxIdLength = 64;

    public async Task InvokeAsync(HttpContext ctx)
    {
        var correlationId = ResolveIncoming(ctx) ?? NewId();

        // Echo in response so clients can see the id (useful when debugging a specific request)
        ctx.Response.Headers[HeaderName] = correlationId;

        // Expose to downstream code via HttpContext.Items for the envelope filter / exception middleware
        ctx.Items["CorrelationId"] = correlationId;

        // Scope the id onto every Serilog event emitted during this request
        using (LogContext.PushProperty("CorrelationId", correlationId))
        {
            await next(ctx);
        }
    }

    private static string? ResolveIncoming(HttpContext ctx)
    {
        if (!ctx.Request.Headers.TryGetValue(HeaderName, out var values)) return null;
        var value = values.ToString();
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (value.Length > MaxIdLength) value = value[..MaxIdLength];
        // Keep only safe chars to avoid log-injection
        foreach (var c in value)
            if (!char.IsLetterOrDigit(c) && c != '-' && c != '_')
                return null;
        return value;
    }

    private static string NewId() => Guid.NewGuid().ToString("N")[..16];
}

/// <summary>Convenience accessor for the current request's correlation id.</summary>
public static class CorrelationIdExtensions
{
    public static string? GetCorrelationId(this HttpContext ctx) =>
        ctx.Items["CorrelationId"] as string;
}
