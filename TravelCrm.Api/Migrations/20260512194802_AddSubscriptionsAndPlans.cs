using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSubscriptionsAndPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "plans",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    monthly_price = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    annual_price_per_month = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    flat_monthly_price = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    currency = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false, defaultValue: "INR"),
                    seat_limit = table.Column<int>(type: "integer", nullable: true),
                    storage_gb_limit = table.Column<int>(type: "integer", nullable: true),
                    webhook_limit = table.Column<int>(type: "integer", nullable: true),
                    workflow_rule_limit = table.Column<int>(type: "integer", nullable: true),
                    marketing_rule_limit = table.Column<int>(type: "integer", nullable: true),
                    chat_license_limit = table.Column<int>(type: "integer", nullable: true),
                    department_limit = table.Column<int>(type: "integer", nullable: true),
                    role_limit = table.Column<int>(type: "integer", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    is_contact_sales_only = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_plans", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "plan_features",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    plan_id = table.Column<Guid>(type: "uuid", nullable: false),
                    feature_code = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_plan_features", x => x.id);
                    table.ForeignKey(
                        name: "fk_plan_features_plans_plan_id",
                        column: x => x.plan_id,
                        principalTable: "plans",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tenant_subscriptions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    plan_id = table.Column<Guid>(type: "uuid", nullable: false),
                    plan_code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    trial_started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    trial_ends_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    current_period_start = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    current_period_end = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    activated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancelled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    storage_used_bytes = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tenant_subscriptions", x => x.id);
                    table.ForeignKey(
                        name: "fk_tenant_subscriptions_plans_plan_id",
                        column: x => x.plan_id,
                        principalTable: "plans",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_tenant_subscriptions_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_plan_features_plan_id_feature_code",
                table: "plan_features",
                columns: new[] { "plan_id", "feature_code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_plans_code",
                table: "plans",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_tenant_subscriptions_plan_id",
                table: "tenant_subscriptions",
                column: "plan_id");

            migrationBuilder.CreateIndex(
                name: "ix_tenant_subscriptions_status_current_period_end",
                table: "tenant_subscriptions",
                columns: new[] { "status", "current_period_end" });

            migrationBuilder.CreateIndex(
                name: "ix_tenant_subscriptions_status_trial_ends_at",
                table: "tenant_subscriptions",
                columns: new[] { "status", "trial_ends_at" });

            migrationBuilder.CreateIndex(
                name: "ix_tenant_subscriptions_tenant_id",
                table: "tenant_subscriptions",
                column: "tenant_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "plan_features");

            migrationBuilder.DropTable(
                name: "tenant_subscriptions");

            migrationBuilder.DropTable(
                name: "plans");
        }
    }
}
