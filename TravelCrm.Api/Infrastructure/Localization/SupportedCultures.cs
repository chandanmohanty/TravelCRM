namespace TravelCrm.Api.Infrastructure.Localization;

public static class SupportedCultures
{
    public static readonly string[] All = ["en", "en-IN", "hi-IN", "ar-AE", "es", "fr", "de"];

    public static readonly LanguageInfo[] Languages =
    [
        new("en", "English", false),
        new("en-IN", "English (India)", false),
        new("hi-IN", "Hindi", false),
        new("ar-AE", "Arabic (UAE)", true),
        new("es", "Spanish", false),
        new("fr", "French", false),
        new("de", "German", false),
    ];

    public record LanguageInfo(string Code, string Name, bool Rtl);
}
