using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStorageConfiguration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "storage_configurations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    driver = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    base_path = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    aws_access_key = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    aws_secret_key = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    aws_region = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    aws_bucket = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    aws_endpoint = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    azure_connection_string = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    azure_container_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    gcs_service_account_json = table.Column<string>(type: "text", nullable: true),
                    gcs_bucket = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    max_file_size_bytes = table.Column<long>(type: "bigint", nullable: false),
                    allowed_content_types = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_storage_configurations", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_storage_configurations_tenant_id_name",
                table: "storage_configurations",
                columns: new[] { "tenant_id", "name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "storage_configurations");
        }
    }
}
