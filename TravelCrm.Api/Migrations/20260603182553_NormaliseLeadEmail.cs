using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class NormaliseLeadEmail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Canonicalise existing email values so the converter-applied lowercased
            // keys match what's already in the DB. Index uses LOWER(email) implicitly
            // via the converter; after this update, the column itself is canonical.
            migrationBuilder.Sql("UPDATE leads SET email = lower(trim(email)) WHERE email <> lower(trim(email));");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // No-op: cannot reconstruct the original mixed-case values.
        }
    }
}
