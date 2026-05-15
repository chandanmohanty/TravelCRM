using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TravelCrm.Api.Migrations
{
    /// <inheritdoc />
    public partial class DealPipelineIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "ix_deals_tenant_id_pipeline_id_is_deleted",
                table: "deals",
                columns: new[] { "tenant_id", "pipeline_id", "is_deleted" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_deals_tenant_id_pipeline_id_is_deleted",
                table: "deals");
        }
    }
}
