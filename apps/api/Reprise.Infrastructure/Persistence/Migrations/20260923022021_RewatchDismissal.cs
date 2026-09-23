using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Reprise.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RewatchDismissal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "rewatch_dismissed_at",
                table: "tracked_series",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "rewatch_dismissed_at",
                table: "tracked_series");
        }
    }
}
