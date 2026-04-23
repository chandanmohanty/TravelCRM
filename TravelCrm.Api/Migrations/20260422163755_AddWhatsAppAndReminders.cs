using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWhatsAppAndReminders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "reminders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    message_template = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    trigger_type = table.Column<int>(type: "integer", nullable: false),
                    channel = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    cron_expression = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    scheduled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    event_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    delay_minutes = table.Column<int>(type: "integer", nullable: true),
                    recipient_phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    recipient_email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    recipient_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    hangfire_job_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_reminders", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "whats_app_provider_configurations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    provider = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    api_key = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    app_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    phone_number = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    base_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_whats_app_provider_configurations", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_reminders_tenant_id_status",
                table: "reminders",
                columns: new[] { "tenant_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_whats_app_provider_configurations_tenant_id_name",
                table: "whats_app_provider_configurations",
                columns: new[] { "tenant_id", "name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "reminders");

            migrationBuilder.DropTable(
                name: "whats_app_provider_configurations");
        }
    }
}
