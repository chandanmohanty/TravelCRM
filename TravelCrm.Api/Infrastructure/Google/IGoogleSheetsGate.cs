namespace TravelCrm.Api.Infrastructure.Google;

/// <summary>
/// Tells the rest of the app whether the Google Sheets OAuth path is configured.
/// When false, all Google-sync UI/endpoints should treat the integration as
/// dormant (the Excel import path remains fully functional).
/// </summary>
public interface IGoogleSheetsGate
{
    bool IsConfigured { get; }
}
