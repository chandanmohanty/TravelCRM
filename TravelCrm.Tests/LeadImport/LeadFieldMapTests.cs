using TravelCrm.Api.Domain.Entities;
using TravelCrm.Api.Features.Crm.LeadImport;
using Xunit;

namespace TravelCrm.Tests.LeadImport;

public sealed class LeadFieldMapTests
{
    [Fact]
    public void Catalog_has_email_required_and_others_optional()
    {
        var email = LeadFieldMap.Fields.Single(f => f.Key == "email");
        Assert.True(email.Required);
        Assert.True(LeadFieldMap.Fields.Single(f => f.Key == "firstName").Required == false);
    }

    [Theory]
    [InlineData("E-mail", "email")]
    [InlineData("Email Address", "email")]
    [InlineData("First Name", "firstName")]
    [InlineData("Phone No.", "phone")]
    [InlineData("Company Name", "company")]
    public void GuessMapping_matches_fuzzy_headers(string header, string expectedField)
    {
        var map = LeadFieldMap.GuessMapping(new[] { header });
        Assert.Equal(header, map[expectedField]);
    }

    [Fact]
    public void Project_valid_row_produces_lead_with_normalised_email()
    {
        var row = new Dictionary<string, string> { ["E-mail"] = "  Bob@Example.COM ", ["First"] = "Bob" };
        var map = new Dictionary<string, string> { ["email"] = "E-mail", ["firstName"] = "First" };
        var (lead, error) = LeadFieldMap.Project(row, map);
        Assert.Null(error);
        Assert.Equal("bob@example.com", lead!.Email);
        Assert.Equal("Bob", lead.FirstName);
    }

    [Fact]
    public void Project_missing_email_fails()
    {
        var (_, error) = LeadFieldMap.Project(
            new Dictionary<string, string> { ["First"] = "Bob" },
            new Dictionary<string, string> { ["email"] = "E-mail", ["firstName"] = "First" });
        Assert.Contains("email", error, System.StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Project_converted_status_is_rejected()
    {
        var (_, error) = LeadFieldMap.Project(
            new Dictionary<string, string> { ["E-mail"] = "a@b.com", ["S"] = "Converted" },
            new Dictionary<string, string> { ["email"] = "E-mail", ["status"] = "S" });
        Assert.Contains("Converted", error);
    }

    [Fact]
    public void Project_clamps_out_of_range_score()
    {
        var (lead, error) = LeadFieldMap.Project(
            new Dictionary<string, string> { ["E-mail"] = "a@b.com", ["Sc"] = "999" },
            new Dictionary<string, string> { ["email"] = "E-mail", ["score"] = "Sc" });
        Assert.Null(error);
        Assert.Equal(100, lead!.Score);
    }

    [Fact]
    public void Project_splits_tags_on_comma_and_semicolon()
    {
        var (lead, error) = LeadFieldMap.Project(
            new Dictionary<string, string> { ["E"] = "a@b.com", ["T"] = "  vip , gold; new " },
            new Dictionary<string, string> { ["email"] = "E", ["tags"] = "T" });
        Assert.Null(error);
        Assert.Equal(new[] { "vip", "gold", "new" }, lead!.Tags);
    }

    [Fact]
    public void Project_parses_known_source_case_insensitively()
    {
        var (lead, error) = LeadFieldMap.Project(
            new Dictionary<string, string> { ["E"] = "a@b.com", ["S"] = "website" },
            new Dictionary<string, string> { ["email"] = "E", ["source"] = "S" });
        Assert.Null(error);
        Assert.Equal(LeadSource.Website, lead!.Source);
    }

    [Fact]
    public void Project_unknown_source_falls_back_to_Other()
    {
        var (lead, error) = LeadFieldMap.Project(
            new Dictionary<string, string> { ["E"] = "a@b.com", ["S"] = "junk-source-name" },
            new Dictionary<string, string> { ["email"] = "E", ["source"] = "S" });
        Assert.Null(error);
        Assert.Equal(LeadSource.Other, lead!.Source);
    }

    [Fact]
    public void Project_unknown_status_falls_back_to_New()
    {
        var (lead, error) = LeadFieldMap.Project(
            new Dictionary<string, string> { ["E"] = "a@b.com", ["S"] = "Whatever" },
            new Dictionary<string, string> { ["email"] = "E", ["status"] = "S" });
        Assert.Null(error);
        Assert.Equal(LeadStatus.New, lead!.Status);
    }

    [Fact]
    public void Project_rejects_negative_estimated_value()
    {
        // Negative input is silently ignored (EstimatedValue stays null), not an error.
        var (lead, error) = LeadFieldMap.Project(
            new Dictionary<string, string> { ["E"] = "a@b.com", ["V"] = "-50" },
            new Dictionary<string, string> { ["email"] = "E", ["estimatedValue"] = "V" });
        Assert.Null(error);
        Assert.Null(lead!.EstimatedValue);
    }

    [Fact]
    public void Project_rejects_overlong_email()
    {
        var longLocal = new string('a', 260);
        var (lead, error) = LeadFieldMap.Project(
            new Dictionary<string, string> { ["E"] = $"{longLocal}@b.com" },
            new Dictionary<string, string> { ["email"] = "E" });
        Assert.Null(lead);
        Assert.Contains("email", error, System.StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void GuessMapping_falls_back_to_contains_match()
    {
        // "Customer Phone Number" doesn't exact-match any synonym, but contains "phonenumber".
        var map = LeadFieldMap.GuessMapping(new[] { "Customer Phone Number" });
        Assert.Equal("Customer Phone Number", map["phone"]);
    }
}
