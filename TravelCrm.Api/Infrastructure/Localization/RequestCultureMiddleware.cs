using System.Globalization;

namespace TravelCrm.Api.Infrastructure.Localization;

public class RequestCultureMiddleware
{
    private readonly RequestDelegate _next;

    public RequestCultureMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        // Priority: Accept-Language header > fallback "en"
        var lang = context.Request.Headers.AcceptLanguage.FirstOrDefault()?.Split(',').FirstOrDefault()?.Trim();

        if (string.IsNullOrWhiteSpace(lang) || !SupportedCultures.All.Contains(lang))
            lang = "en";

        try
        {
            var culture = new CultureInfo(lang);
            CultureInfo.CurrentCulture = culture;
            CultureInfo.CurrentUICulture = culture;
        }
        catch (CultureNotFoundException)
        {
            // Fallback to English
            CultureInfo.CurrentCulture = new CultureInfo("en");
            CultureInfo.CurrentUICulture = new CultureInfo("en");
        }

        context.Items["Culture"] = lang;
        await _next(context);
    }
}
