using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPlatformAdmin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "EmailIndex",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "ix_users_tenant_id_normalized_email",
                table: "Users");

            migrationBuilder.AlterColumn<Guid>(
                name: "tenant_id",
                table: "Users",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<bool>(
                name: "is_platform_admin",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AlterColumn<Guid>(
                name: "tenant_id",
                table: "Roles",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.CreateIndex(
                name: "ix_users_platform_email",
                table: "Users",
                column: "normalized_email",
                unique: true,
                filter: "is_deleted = false AND tenant_id IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_users_tenant_email",
                table: "Users",
                columns: new[] { "tenant_id", "normalized_email" },
                unique: true,
                filter: "is_deleted = false AND tenant_id IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_users_platform_email",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "ix_users_tenant_email",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "is_platform_admin",
                table: "Users");

            migrationBuilder.AlterColumn<Guid>(
                name: "tenant_id",
                table: "Users",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "tenant_id",
                table: "Roles",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                table: "Users",
                column: "normalized_email");

            migrationBuilder.CreateIndex(
                name: "ix_users_tenant_id_normalized_email",
                table: "Users",
                columns: new[] { "tenant_id", "normalized_email" },
                unique: true,
                filter: "is_deleted = false");
        }
    }
}
