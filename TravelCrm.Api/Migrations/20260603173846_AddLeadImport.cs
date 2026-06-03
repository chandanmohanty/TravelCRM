using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLeadImport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "google_oauth_tokens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    refresh_token = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    granted_scopes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    connected_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    connected_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_google_oauth_tokens", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lead_import_sources",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    display_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    spreadsheet_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    sheet_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    column_mapping = table.Column<string>(type: "jsonb", nullable: false),
                    match_key_field = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    sync_cadence = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    last_polled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_success_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_result_json = table.Column<string>(type: "jsonb", nullable: true),
                    last_error = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    row_version = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_lead_import_sources", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lead_import_staging",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    rows_json = table.Column<string>(type: "jsonb", nullable: false),
                    headers_json = table.Column<string>(type: "jsonb", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_lead_import_staging", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "lead_import_row_states",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    import_source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    match_key = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    content_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    lead_id = table.Column<Guid>(type: "uuid", nullable: true),
                    last_seen_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_lead_import_row_states", x => x.id);
                    table.ForeignKey(
                        name: "fk_lead_import_row_states_lead_import_sources_import_source_id",
                        column: x => x.import_source_id,
                        principalTable: "lead_import_sources",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_google_oauth_tokens_tenant_id",
                table: "google_oauth_tokens",
                column: "tenant_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_lead_import_row_states_import_source_id_match_key",
                table: "lead_import_row_states",
                columns: new[] { "import_source_id", "match_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_lead_import_sources_tenant_id_status",
                table: "lead_import_sources",
                columns: new[] { "tenant_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_lead_import_staging_tenant_id_created_at",
                table: "lead_import_staging",
                columns: new[] { "tenant_id", "created_at" });

            // Auto-generate row_version bytes on insert/update for lead_import_sources.
            // EF Core's IsRowVersion() on Npgsql bytea requires a DB-generated value.
            // NOTE: gen_random_bytes(16) requires pgcrypto (not installed); use
            // decode(replace(gen_random_uuid()::text,'-',''),'hex') which is built-in
            // (gen_random_uuid is native since PG13) and produces exactly 16 bytes.
            migrationBuilder.Sql(@"
CREATE OR REPLACE FUNCTION fn_lead_import_source_row_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.row_version := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lead_import_source_row_version ON lead_import_sources;
CREATE TRIGGER trg_lead_import_source_row_version
BEFORE INSERT OR UPDATE ON lead_import_sources
FOR EACH ROW EXECUTE FUNCTION fn_lead_import_source_row_version();
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP TRIGGER IF EXISTS trg_lead_import_source_row_version ON lead_import_sources;
DROP FUNCTION IF EXISTS fn_lead_import_source_row_version();
");

            migrationBuilder.DropTable(
                name: "google_oauth_tokens");

            migrationBuilder.DropTable(
                name: "lead_import_row_states");

            migrationBuilder.DropTable(
                name: "lead_import_staging");

            migrationBuilder.DropTable(
                name: "lead_import_sources");
        }
    }
}
