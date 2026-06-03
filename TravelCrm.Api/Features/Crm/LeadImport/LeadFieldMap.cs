using System.Text.RegularExpressions;
using TravelCrm.Api.Domain.Entities;

namespace TravelCrm.Api.Features.Crm.LeadImport;

/// <summary>
/// Single source of truth for the importable Lead field catalog, fuzzy header
/// guessing, and row→Lead projection+validation. Shared by Excel and Sheets.
/// </summary>
public static class LeadFieldMap
{
    public static readonly IReadOnlyList<ImportFieldDto> Fields = new[]
    {
        new ImportFieldDto("email", "Email", true),
        new ImportFieldDto("firstName", "First Name", false),
        new ImportFieldDto("lastName", "Last Name", false),
        new ImportFieldDto("phone", "Phone", false),
        new ImportFieldDto("company", "Company", false),
        new ImportFieldDto("jobTitle", "Job Title", false),
        new ImportFieldDto("assignedTo", "Assigned To", false),
        new ImportFieldDto("status", "Status", false),
        new ImportFieldDto("source", "Source", false),
        new ImportFieldDto("score", "Score", false),
        new ImportFieldDto("estimatedValue", "Estimated Value", false),
        new ImportFieldDto("tags", "Tags", false),
        new ImportFieldDto("notes", "Notes", false),
    };

    private static readonly Dictionary<string, string[]> Synonyms = new()
    {
        ["email"]          = new[] { "email", "e-mail", "emailaddress", "mail" },
        ["firstName"]      = new[] { "firstname", "first", "fname", "givenname" },
        ["lastName"]       = new[] { "lastname", "last", "lname", "surname", "familyname" },
        ["phone"]          = new[] { "phone", "phoneno", "phonenumber", "mobile", "contact", "tel" },
        ["company"]        = new[] { "company", "companyname", "organisation", "organization", "account" },
        ["jobTitle"]       = new[] { "jobtitle", "title", "designation", "role" },
        ["assignedTo"]     = new[] { "assignedto", "owner", "salesrep", "agent" },
        ["status"]         = new[] { "status", "leadstatus", "stage" },
        ["source"]         = new[] { "source", "leadsource", "channel" },
        ["score"]          = new[] { "score", "leadscore", "rating" },
        ["estimatedValue"] = new[] { "estimatedvalue", "value", "dealvalue", "amount", "budget" },
        ["tags"]           = new[] { "tags", "labels", "categories" },
        ["notes"]          = new[] { "notes", "note", "comments", "remarks", "description" },
    };

    private static readonly Regex NormRx =
        new("[^a-z0-9]", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static string Norm(string s) =>
        NormRx.Replace(s ?? string.Empty, "").ToLowerInvariant();

    /// <summary>CRM field → best-guess source header (only confident matches).</summary>
    public static Dictionary<string, string> GuessMapping(IEnumerable<string> headers)
    {
        var result = new Dictionary<string, string>();
        var hs = headers.Where(h => !string.IsNullOrWhiteSpace(h)).ToList();
        foreach (var (field, syns) in Synonyms)
        {
            var hit = hs.FirstOrDefault(h => syns.Contains(Norm(h)))
                   ?? hs.FirstOrDefault(h => syns.Any(s => Norm(h).Contains(s)));
            if (hit != null) result[field] = hit;
        }
        return result;
    }

    private static readonly Regex EmailRx =
        new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled);

    /// <summary>
    /// Project a source row through a mapping into a Lead. Returns
    /// (lead, null) on success or (null, reason) on a row error.
    /// </summary>
    public static (Lead? lead, string? error) Project(
        IReadOnlyDictionary<string, string> row,
        IReadOnlyDictionary<string, string> mapping)
    {
        string Get(string field) =>
            mapping.TryGetValue(field, out var hdr) && row.TryGetValue(hdr, out var v)
                ? (v ?? string.Empty).Trim() : string.Empty;

        var email = Get("email").ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email)) return (null, "Missing required field: email");
        if (!EmailRx.IsMatch(email)) return (null, $"Invalid email: {email}");
        if (email.Length > 256) return (null, $"Email too long (max 256): {email}");

        var lead = new Lead
        {
            Email     = email,
            FirstName = Clamp(Get("firstName"), 100),
            LastName  = Clamp(Get("lastName"), 100),
            Phone     = Clamp(Get("phone"), 50),
            Company   = Clamp(Get("company"), 200),
            JobTitle  = Clamp(Get("jobTitle"), 200),
            AssignedTo= Clamp(Get("assignedTo"), 200),
            Notes     = Clamp(Get("notes"), 4000),
        };

        var statusRaw = Get("status");
        if (!string.IsNullOrWhiteSpace(statusRaw))
        {
            if (Enum.TryParse<LeadStatus>(statusRaw, true, out var st))
            {
#pragma warning disable CS0618
                if (st == LeadStatus.Converted)
                    return (null, "Status 'Converted' is retired — use a Deal to express conversion");
#pragma warning restore CS0618
                lead.Status = st;
            }
            else lead.Status = LeadStatus.New;
        }

        var srcRaw = Get("source");
        lead.Source = Enum.TryParse<LeadSource>(srcRaw, true, out var sr) ? sr : LeadSource.Other;

        var scoreRaw = Get("score");
        if (int.TryParse(scoreRaw, out var sc)) lead.Score = Math.Clamp(sc, 0, 100);

        var evRaw = Get("estimatedValue");
        if (decimal.TryParse(evRaw, out var ev) && ev >= 0) lead.EstimatedValue = ev;

        var tagsRaw = Get("tags");
        if (!string.IsNullOrWhiteSpace(tagsRaw))
            lead.Tags = tagsRaw.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

        return (lead, null);
    }

    private static string Clamp(string s, int max) =>
        string.IsNullOrEmpty(s) ? string.Empty : (s.Length <= max ? s : s[..max]);
}
