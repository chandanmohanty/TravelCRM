using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "task_types",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    color = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_task_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tenant_tasks",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    priority = table.Column<int>(type: "integer", nullable: false),
                    task_type_id = table.Column<Guid>(type: "uuid", nullable: true),
                    assigned_to_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    parent_task_id = table.Column<Guid>(type: "uuid", nullable: true),
                    due_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    estimated_minutes = table.Column<int>(type: "integer", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                    is_overdue_sent = table.Column<bool>(type: "boolean", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tenant_tasks", x => x.id);
                    table.ForeignKey(
                        name: "fk_tenant_tasks_task_types_task_type_id",
                        column: x => x.task_type_id,
                        principalTable: "task_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_tenant_tasks_tenant_tasks_parent_task_id",
                        column: x => x.parent_task_id,
                        principalTable: "tenant_tasks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "time_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    task_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    minutes = table.Column<int>(type: "integer", nullable: false),
                    notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    logged_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_time_entries", x => x.id);
                    table.ForeignKey(
                        name: "fk_time_entries_tenant_tasks_task_id",
                        column: x => x.task_id,
                        principalTable: "tenant_tasks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_task_types_tenant_id_name",
                table: "task_types",
                columns: new[] { "tenant_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_tenant_tasks_parent_task_id",
                table: "tenant_tasks",
                column: "parent_task_id");

            migrationBuilder.CreateIndex(
                name: "ix_tenant_tasks_task_type_id",
                table: "tenant_tasks",
                column: "task_type_id");

            migrationBuilder.CreateIndex(
                name: "ix_tenant_tasks_tenant_id_assigned_to_user_id",
                table: "tenant_tasks",
                columns: new[] { "tenant_id", "assigned_to_user_id" });

            migrationBuilder.CreateIndex(
                name: "ix_tenant_tasks_tenant_id_is_deleted",
                table: "tenant_tasks",
                columns: new[] { "tenant_id", "is_deleted" });

            migrationBuilder.CreateIndex(
                name: "ix_tenant_tasks_tenant_id_status",
                table: "tenant_tasks",
                columns: new[] { "tenant_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_time_entries_task_id",
                table: "time_entries",
                column: "task_id");

            migrationBuilder.CreateIndex(
                name: "ix_time_entries_tenant_id_task_id",
                table: "time_entries",
                columns: new[] { "tenant_id", "task_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "time_entries");

            migrationBuilder.DropTable(
                name: "tenant_tasks");

            migrationBuilder.DropTable(
                name: "task_types");
        }
    }
}
