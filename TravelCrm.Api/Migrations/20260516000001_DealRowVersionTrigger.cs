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
            // NOTE: gen_random_bytes(16) requires pgcrypto; use decode(replace(gen_random_uuid()::text,'-',''),'hex')
            // which is built-in (gen_random_uuid is native since PG13) and produces exactly 16 bytes.
            // Fixed in 20260516000002_FixDealRowVersionTrigger — this file kept for migration history accuracy.
            migrationBuilder.Sql(@"
CREATE OR REPLACE FUNCTION fn_deal_row_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.row_version := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
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
