using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddIdentityModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "department_id",
                table: "Users",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "employee_id",
                table: "Users",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "team_leader_id",
                table: "Users",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "slug",
                table: "Roles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "departments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    manager_id = table.Column<Guid>(type: "uuid", nullable: true),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_departments", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "employee_id_sequences",
                columns: table => new
                {
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    year = table.Column<int>(type: "integer", nullable: false),
                    next_value = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_employee_id_sequences", x => new { x.tenant_id, x.year });
                });

            migrationBuilder.CreateTable(
                name: "password_reset_tokens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    token_hash = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    consumed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ip_address = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_password_reset_tokens", x => x.id);
                    table.ForeignKey(
                        name: "fk_password_reset_tokens_users_user_id",
                        column: x => x.user_id,
                        principalTable: "Users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "permissions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    module = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    submodule = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    action = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_permissions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "role_permissions",
                columns: table => new
                {
                    role_id = table.Column<Guid>(type: "uuid", nullable: false),
                    permission_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    granted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    granted_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_role_permissions", x => new { x.role_id, x.permission_id });
                    table.ForeignKey(
                        name: "fk_role_permissions_permissions_permission_id",
                        column: x => x.permission_id,
                        principalTable: "permissions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_role_permissions_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "Roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_users_tenant_employee_id",
                table: "Users",
                columns: new[] { "tenant_id", "employee_id" },
                unique: true,
                filter: "is_deleted = false AND employee_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_roles_tenant_slug",
                table: "Roles",
                columns: new[] { "tenant_id", "slug" },
                unique: true,
                filter: "slug IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_departments_tenant_name",
                table: "departments",
                columns: new[] { "tenant_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_password_reset_tokens_token_hash",
                table: "password_reset_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_password_reset_tokens_user_id_expires_at",
                table: "password_reset_tokens",
                columns: new[] { "user_id", "expires_at" });

            migrationBuilder.CreateIndex(
                name: "ix_permissions_module_submodule_sort_order",
                table: "permissions",
                columns: new[] { "module", "submodule", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "ix_permissions_tenant_id_slug",
                table: "permissions",
                columns: new[] { "tenant_id", "slug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_role_permissions_permission_id",
                table: "role_permissions",
                column: "permission_id");

            migrationBuilder.CreateIndex(
                name: "ix_role_permissions_role_id",
                table: "role_permissions",
                column: "role_id");

            migrationBuilder.CreateIndex(
                name: "ix_role_permissions_tenant_id",
                table: "role_permissions",
                column: "tenant_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "departments");

            migrationBuilder.DropTable(
                name: "employee_id_sequences");

            migrationBuilder.DropTable(
                name: "password_reset_tokens");

            migrationBuilder.DropTable(
                name: "role_permissions");

            migrationBuilder.DropTable(
                name: "permissions");

            migrationBuilder.DropIndex(
                name: "ix_users_tenant_employee_id",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "ix_roles_tenant_slug",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "department_id",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "employee_id",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "team_leader_id",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "slug",
                table: "Roles");
        }
    }
}
