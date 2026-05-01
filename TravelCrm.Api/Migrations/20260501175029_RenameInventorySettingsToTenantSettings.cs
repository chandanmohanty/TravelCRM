using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class RenameInventorySettingsToTenantSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameTable(
                name: "inventory_settings",
                newName: "tenant_settings");

            migrationBuilder.RenameIndex(
                name: "ix_inventory_settings_tenant_id",
                table: "tenant_settings",
                newName: "ix_tenant_settings_tenant_id");

            migrationBuilder.RenameIndex(
                name: "pk_inventory_settings",
                table: "tenant_settings",
                newName: "pk_tenant_settings");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameIndex(
                name: "pk_tenant_settings",
                table: "inventory_settings",
                newName: "pk_inventory_settings");

            migrationBuilder.RenameIndex(
                name: "ix_tenant_settings_tenant_id",
                table: "inventory_settings",
                newName: "ix_inventory_settings_tenant_id");

            migrationBuilder.RenameTable(
                name: "tenant_settings",
                newName: "inventory_settings");
        }
    }
}
