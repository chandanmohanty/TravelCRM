using System.Text;
using ClosedXML.Excel;
using TravelCrm.Api.Features.Crm.LeadImport.Parsing;
using Xunit;

namespace TravelCrm.Tests.LeadImport;

public sealed class TabularParserTests
{
    [Fact]
    public void Csv_parses_headers_and_rows()
    {
        var csv = "Email,First\r\na@b.com,Bob\r\nc@d.com,Carol\r\n";
        var p = new CsvLeadParser();
        Assert.True(p.CanParse("leads.csv"));
        var d = p.Parse(new MemoryStream(Encoding.UTF8.GetBytes(csv)), "leads.csv");
        Assert.Equal(new[] { "Email", "First" }, d.Headers);
        Assert.Equal(2, d.Rows.Count);
        Assert.Equal("a@b.com", d.Rows[0]["Email"]);
    }

    [Fact]
    public void Csv_handles_quoted_comma()
    {
        var csv = "Email,Notes\r\na@b.com,\"Hello, world\"\r\n";
        var d = new CsvLeadParser().Parse(new MemoryStream(Encoding.UTF8.GetBytes(csv)), "x.csv");
        Assert.Equal("Hello, world", d.Rows[0]["Notes"]);
    }

    [Fact]
    public void Xlsx_parses_first_sheet()
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Sheet1");
        ws.Cell(1, 1).Value = "Email"; ws.Cell(1, 2).Value = "First";
        ws.Cell(2, 1).Value = "a@b.com"; ws.Cell(2, 2).Value = "Bob";
        using var ms = new MemoryStream();
        wb.SaveAs(ms); ms.Position = 0;
        var p = new ClosedXmlLeadParser();
        Assert.True(p.CanParse("leads.xlsx"));
        var d = p.Parse(ms, "leads.xlsx");
        Assert.Equal(new[] { "Email", "First" }, d.Headers);
        Assert.Equal("Bob", d.Rows[0]["First"]);
    }

    [Fact]
    public void Xls_is_rejected_with_helpful_message()
    {
        var p = new ClosedXmlLeadParser();
        var ex = Assert.Throws<LeadImportParseException>(
            () => p.Parse(new MemoryStream(new byte[] { 1 }), "old.xls"));
        Assert.Contains(".xlsx", ex.Message);
    }

    [Fact]
    public void Csv_over_row_cap_throws()
    {
        var sb = new StringBuilder("Email\r\n");
        for (var i = 0; i < 10_001; i++) sb.Append($"u{i}@x.com\r\n");
        var ex = Assert.Throws<LeadImportParseException>(
            () => new CsvLeadParser().Parse(new MemoryStream(Encoding.UTF8.GetBytes(sb.ToString())), "big.csv"));
        Assert.Contains("10,000", ex.Message);
    }

    [Fact]
    public void Csv_handles_lf_only_line_endings()
    {
        var csv = "Email,First\na@b.com,Bob\nc@d.com,Carol\n";
        var d = new CsvLeadParser().Parse(new MemoryStream(Encoding.UTF8.GetBytes(csv)), "lf.csv");
        Assert.Equal(2, d.Rows.Count);
        Assert.Equal("Bob", d.Rows[0]["First"]);
    }

    [Fact]
    public void Csv_handles_cr_only_line_endings()
    {
        var csv = "Email,First\ra@b.com,Bob\rc@d.com,Carol\r";
        var d = new CsvLeadParser().Parse(new MemoryStream(Encoding.UTF8.GetBytes(csv)), "cr.csv");
        Assert.Equal(2, d.Rows.Count);
        Assert.Equal("Carol", d.Rows[1]["First"]);
    }

    [Fact]
    public void Csv_handles_quoted_newline()
    {
        var csv = "Email,Notes\r\na@b.com,\"line1\nline2\"\r\n";
        var d = new CsvLeadParser().Parse(new MemoryStream(Encoding.UTF8.GetBytes(csv)), "q.csv");
        Assert.Equal("line1\nline2", d.Rows[0]["Notes"]);
    }

    [Fact]
    public void Csv_unterminated_quote_throws()
    {
        var csv = "Email,Notes\r\na@b.com,\"oops no close\r\n";
        var ex = Assert.Throws<LeadImportParseException>(
            () => new CsvLeadParser().Parse(new MemoryStream(Encoding.UTF8.GetBytes(csv)), "bad.csv"));
        Assert.Contains("Unterminated", ex.Message);
    }
}
