using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailConfiguration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "email_configurations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    provider = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    smtp_host = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    smtp_port = table.Column<int>(type: "integer", nullable: false),
                    username = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    password = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    enable_ssl = table.Column<bool>(type: "boolean", nullable: false),
                    sender_email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    sender_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    api_key = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    api_domain = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    aws_region = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_email_configurations", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_email_configurations_tenant_id_name",
                table: "email_configurations",
                columns: new[] { "tenant_id", "name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "email_configurations");
        }
    }
}
