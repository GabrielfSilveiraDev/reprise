using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Reprise.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TvmazeSchedule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "tvmaze_id",
                table: "series",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "tvmaze_air_date",
                table: "episodes",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "tvmaze_air_stamp",
                table: "episodes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_series_tvmaze_id",
                table: "series",
                column: "tvmaze_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_series_tvmaze_id",
                table: "series");

            migrationBuilder.DropColumn(
                name: "tvmaze_id",
                table: "series");

            migrationBuilder.DropColumn(
                name: "tvmaze_air_date",
                table: "episodes");

            migrationBuilder.DropColumn(
                name: "tvmaze_air_stamp",
                table: "episodes");
        }
    }
}
