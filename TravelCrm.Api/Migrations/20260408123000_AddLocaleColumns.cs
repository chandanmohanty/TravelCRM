using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLocaleColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "currency_code",
                table: "Users",
                type: "character varying(5)",
                maxLength: 5,
                nullable: false,
                defaultValue: "USD");

            migrationBuilder.AddColumn<string>(
                name: "preferred_language",
                table: "Users",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "en");

            migrationBuilder.AddColumn<string>(
                name: "time_zone",
                table: "Users",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "UTC");

            migrationBuilder.AddColumn<string>(
                name: "default_currency_code",
                table: "tenants",
                type: "character varying(5)",
                maxLength: 5,
                nullable: false,
                defaultValue: "USD");

            migrationBuilder.AddColumn<string>(
                name: "default_language",
                table: "tenants",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "en");

            migrationBuilder.AddColumn<string>(
                name: "default_time_zone",
                table: "tenants",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "UTC");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "currency_code",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "preferred_language",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "time_zone",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "default_currency_code",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "default_language",
                table: "tenants");

            migrationBuilder.DropColumn(
                name: "default_time_zone",
                table: "tenants");
        }
    }
}
