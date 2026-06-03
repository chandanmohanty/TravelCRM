using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace TravelCrm.Api.Infrastructure.Persistence;

/// <summary>
/// Lowercases and trims email values on write so the column is a canonical
/// key. Read-side is a pass-through (existing rows are normalised by the
/// AddLeadEmailNormalisation migration; future inserts are normalised here).
/// </summary>
public sealed class EmailLowerTrimConverter : ValueConverter<string, string>
{
    public EmailLowerTrimConverter()
        : base(
            toDb => (toDb ?? string.Empty).Trim().ToLowerInvariant(),
            fromDb => fromDb)
    { }
}
