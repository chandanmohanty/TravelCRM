using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class InventoryFoundationFixes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_resource_calendar_tenant_id_resource_id_date_slot",
                table: "resource_calendar");

            migrationBuilder.AlterColumn<int>(
                name: "hold_ttl_hours",
                table: "inventory_settings",
                type: "integer",
                nullable: false,
                defaultValue: 24,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.CreateIndex(
                name: "ix_resource_calendar_tenant_id_resource_id_date",
                table: "resource_calendar",
                columns: new[] { "tenant_id", "resource_id", "date" },
                unique: true,
                filter: "slot IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_resource_calendar_tenant_id_resource_id_date_slot",
                table: "resource_calendar",
                columns: new[] { "tenant_id", "resource_id", "date", "slot" },
                unique: true,
                filter: "slot IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_resource_calendar_tenant_id_resource_id_date",
                table: "resource_calendar");

            migrationBuilder.DropIndex(
                name: "ix_resource_calendar_tenant_id_resource_id_date_slot",
                table: "resource_calendar");

            migrationBuilder.AlterColumn<int>(
                name: "hold_ttl_hours",
                table: "inventory_settings",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldDefaultValue: 24);

            migrationBuilder.CreateIndex(
                name: "ix_resource_calendar_tenant_id_resource_id_date_slot",
                table: "resource_calendar",
                columns: new[] { "tenant_id", "resource_id", "date", "slot" },
                unique: true);
        }
    }
}
