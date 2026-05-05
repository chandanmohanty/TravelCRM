using FluentValidation;
using TravelCrm.Api.Common;

namespace TravelCrm.Api.Infrastructure.Middleware;

public sealed class GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await next(ctx);
        }
        catch (ValidationException ex)
        {
            var errors = ex.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());

            await WriteEnvelopeAsync(ctx,
                StatusCodes.Status422UnprocessableEntity,
                "The supplied data was invalid.",
                errors);
        }
        catch (Exception ex)
        {
            var correlationId = ctx.GetCorrelationId();
            logger.LogError(ex, "Unhandled exception (correlationId={CorrelationId})", correlationId);

            await WriteEnvelopeAsync(ctx,
                StatusCodes.Status500InternalServerError,
                "An unexpected error occurred.",
                errors: null);
        }
    }

    private static async Task WriteEnvelopeAsync(
        HttpContext ctx,
        int status,
        string error,
        IReadOnlyDictionary<string, string[]>? errors)
    {
        if (ctx.Response.HasStarted) return;
        ctx.Response.Clear();
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = "application/json";
        var payload = new ApiEnvelope<object?>(
            Success:       false,
            Data:          null,
            Meta:          null,
            Error:         error,
            Errors:        errors,
            CorrelationId: ctx.GetCorrelationId());
        await ctx.Response.WriteAsJsonAsync(payload);
    }
}
