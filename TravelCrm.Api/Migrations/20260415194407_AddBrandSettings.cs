using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBrandSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "platform_brand_settings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    display_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    logo_light_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    logo_dark_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    favicon_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    primary_color_hex = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true),
                    support_email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    support_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_platform_brand_settings", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tenant_brand_settings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    display_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    logo_light_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    logo_dark_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    favicon_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    primary_color_hex = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true),
                    support_email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    support_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tenant_brand_settings", x => x.id);
                    table.ForeignKey(
                        name: "fk_tenant_brand_settings_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_tenant_brand_settings_tenant_id",
                table: "tenant_brand_settings",
                column: "tenant_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "platform_brand_settings");

            migrationBuilder.DropTable(
                name: "tenant_brand_settings");
        }
    }
}
