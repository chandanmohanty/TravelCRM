namespace TravelCrm.Api.Features.Settings.Invoice.DTOs;

public sealed record InvoiceSettingsDto(
    string  NumberingTemplate,
    int     NextSequence,
    string? GstNumber,
    string? GstLegalName,
    string? GstAddress,
    string? GstStateCode,
    string? DefaultTerms,
    string? DefaultNotes);
