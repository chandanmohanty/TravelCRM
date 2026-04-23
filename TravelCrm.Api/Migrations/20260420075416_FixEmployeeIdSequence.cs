using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class FixEmployeeIdSequence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Intentionally no-op at the SQL level. The previous migration declared a
            // `RowVersion` column mapped to `xmin` / `xid`, but PostgreSQL treats
            // `xmin` as a reserved system column name and silently skipped creating
            // it. Removing the property from the entity brings the EF snapshot back
            // in line with the physical schema; no ALTER TABLE is needed (and indeed
            // Postgres would reject DROP COLUMN xmin because it's a system column).
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // No-op: re-adding `xmin` would collide with the PG system column.
        }
    }
}
