using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Reprise.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SeriesReturn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "returned_at",
                table: "tracked_series",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "status_changed_at",
                table: "tracked_series",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "returned_at",
                table: "tracked_series");

            migrationBuilder.DropColumn(
                name: "status_changed_at",
                table: "tracked_series");
        }
    }
}
