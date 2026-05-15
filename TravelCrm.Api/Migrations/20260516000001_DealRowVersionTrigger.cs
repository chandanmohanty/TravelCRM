using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelCrm.Api.Migrations
{
    /// <inheritdoc />
    [Migration("20260516000001_DealRowVersionTrigger")]
    [DbContext(typeof(TravelCrm.Api.Infrastructure.Persistence.ApplicationDbContext))]
    public partial class DealRowVersionTrigger : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Create a trigger function that auto-generates row_version bytes on insert/update.
            // EF Core's IsRowVersion() on Npgsql bytea requires a DB-generated value.
            // Uses gen_random_bytes(16) — built-in CSPRNG on PG18, always exactly 16 bytes,
            // no pgcrypto extension needed.
            migrationBuilder.Sql(@"
CREATE OR REPLACE FUNCTION fn_deal_row_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.row_version := gen_random_bytes(16);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deal_row_version ON deals;
CREATE TRIGGER trg_deal_row_version
BEFORE INSERT OR UPDATE ON deals
FOR EACH ROW EXECUTE FUNCTION fn_deal_row_version();
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP TRIGGER IF EXISTS trg_deal_row_version ON deals;
DROP FUNCTION IF EXISTS fn_deal_row_version();
");
        }
    }
}
