namespace TravelCrm.Api.Features.Settings.System.DTOs;

public sealed record SystemSettingsDto(
    string DateFormat,
    string TimeFormat,
    string DefaultTimeZone,
    string DefaultCurrencyCode,
    int    FiscalYearStartMonth,
    int    FiscalYearStartDay);
