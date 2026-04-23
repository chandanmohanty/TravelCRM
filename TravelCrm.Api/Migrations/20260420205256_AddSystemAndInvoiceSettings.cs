using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSystemAndInvoiceSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "identity_activities",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    subject_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    actor_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    actor_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    activity_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    metadata = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_identity_activities", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "invoice_settings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    numbering_template = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    next_sequence = table.Column<int>(type: "integer", nullable: false),
                    gst_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    gst_legal_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    gst_address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    gst_state_code = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: true),
                    default_terms = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    default_notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_invoice_settings", x => x.id);
                    table.ForeignKey(
                        name: "fk_invoice_settings_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "system_settings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    date_format = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    time_format = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    default_time_zone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    default_currency_code = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    fiscal_year_start_month = table.Column<int>(type: "integer", nullable: false),
                    fiscal_year_start_day = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_system_settings", x => x.id);
                    table.ForeignKey(
                        name: "fk_system_settings_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_identity_activities_tenant_id_created_at",
                table: "identity_activities",
                columns: new[] { "tenant_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_identity_activities_tenant_id_subject_user_id_created_at",
                table: "identity_activities",
                columns: new[] { "tenant_id", "subject_user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_invoice_settings_tenant_id",
                table: "invoice_settings",
                column: "tenant_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_system_settings_tenant_id",
                table: "system_settings",
                column: "tenant_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "identity_activities");

            migrationBuilder.DropTable(
                name: "invoice_settings");

            migrationBuilder.DropTable(
                name: "system_settings");
        }
    }
}
