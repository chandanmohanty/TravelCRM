using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAiProviderConfiguration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ai_provider_configurations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    provider = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    model = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    api_key = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    base_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    temperature = table.Column<double>(type: "double precision", nullable: true),
                    max_tokens = table.Column<int>(type: "integer", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ai_provider_configurations", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_ai_provider_configurations_tenant_id_name",
                table: "ai_provider_configurations",
                columns: new[] { "tenant_id", "name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ai_provider_configurations");
        }
    }
}
