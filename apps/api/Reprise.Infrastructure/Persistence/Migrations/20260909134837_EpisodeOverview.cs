using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Reprise.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EpisodeOverview : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "overview",
                table: "episodes",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "overview",
                table: "episodes");
        }
    }
}
