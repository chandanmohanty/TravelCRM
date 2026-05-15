using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelCrm.Api.Migrations
{
    /// <summary>
    /// Corrects fn_deal_row_version() to use decode(replace(gen_random_uuid()::text,'-',''),'hex')
    /// instead of gen_random_bytes(16). gen_random_bytes requires the pgcrypto extension, which is
    /// not installed by default on all PostgreSQL 18 instances. gen_random_uuid() is built-in since
    /// PG13 and produces a CSPRNG-backed UUID whose 32 hex digits decode to exactly 16 bytes.
    /// This migration is idempotent — safe to apply to a DB that already has the correct trigger.
    /// </summary>
    [Migration("20260516000002_FixDealRowVersionTrigger")]
    [DbContext(typeof(TravelCrm.Api.Infrastructure.Persistence.ApplicationDbContext))]
    public partial class FixDealRowVersionTrigger : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
CREATE OR REPLACE FUNCTION fn_deal_row_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.row_version := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Restore the original (broken) body only if explicitly rolling back to exactly this migration.
            // In practice, rolling back should also roll back 20260516000001 which drops the trigger entirely.
            migrationBuilder.Sql(@"
CREATE OR REPLACE FUNCTION fn_deal_row_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.row_version := gen_random_bytes(16);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
");
        }
    }
}
