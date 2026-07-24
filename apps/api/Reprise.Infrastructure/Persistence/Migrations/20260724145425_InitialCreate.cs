using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Reprise.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "import_runs",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    finished_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    source_file_sha256 = table.Column<string>(type: "text", nullable: true),
                    rows_read = table.Column<int>(type: "integer", nullable: false),
                    events_created = table.Column<int>(type: "integer", nullable: false),
                    series_created = table.Column<int>(type: "integer", nullable: false),
                    series_tmdb_matched = table.Column<int>(type: "integer", nullable: false),
                    series_unmatched = table.Column<int>(type: "integer", nullable: false),
                    reconciliation_json = table.Column<string>(type: "jsonb", nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_import_runs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "series",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    tmdb_id = table.Column<int>(type: "integer", nullable: true),
                    tvdb_id = table.Column<int>(type: "integer", nullable: true),
                    name = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    original_name = table.Column<string>(type: "text", nullable: true),
                    overview = table.Column<string>(type: "text", nullable: true),
                    poster_path = table.Column<string>(type: "text", nullable: true),
                    first_air_date = table.Column<DateOnly>(type: "date", nullable: true),
                    status = table.Column<string>(type: "text", nullable: true),
                    fallback_runtime_seconds = table.Column<int>(type: "integer", nullable: true),
                    metadata_enriched = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_series", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "series_match_overrides",
                columns: table => new
                {
                    tvdb_id = table.Column<int>(type: "integer", nullable: false),
                    tmdb_id = table.Column<int>(type: "integer", nullable: false),
                    note = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_series_match_overrides", x => x.tvdb_id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    display_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "seasons",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    series_id = table.Column<long>(type: "bigint", nullable: false),
                    tmdb_id = table.Column<int>(type: "integer", nullable: true),
                    season_number = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "text", nullable: true),
                    episode_count = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_seasons", x => x.id);
                    table.ForeignKey(
                        name: "fk_seasons_series_series_id",
                        column: x => x.series_id,
                        principalTable: "series",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tracked_series",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    series_id = table.Column<long>(type: "bigint", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    followed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    added_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tracked_series", x => x.id);
                    table.ForeignKey(
                        name: "fk_tracked_series_series_series_id",
                        column: x => x.series_id,
                        principalTable: "series",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "episodes",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    series_id = table.Column<long>(type: "bigint", nullable: false),
                    season_id = table.Column<long>(type: "bigint", nullable: false),
                    tmdb_id = table.Column<int>(type: "integer", nullable: true),
                    season_number = table.Column<int>(type: "integer", nullable: false),
                    episode_number = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "text", nullable: true),
                    air_date = table.Column<DateOnly>(type: "date", nullable: true),
                    runtime_seconds = table.Column<int>(type: "integer", nullable: true),
                    runtime_estimated = table.Column<bool>(type: "boolean", nullable: false),
                    is_special = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_episodes", x => x.id);
                    table.ForeignKey(
                        name: "fk_episodes_seasons_season_id",
                        column: x => x.season_id,
                        principalTable: "seasons",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_episodes_series_series_id",
                        column: x => x.series_id,
                        principalTable: "series",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "watch_events",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    episode_id = table.Column<long>(type: "bigint", nullable: false),
                    watched_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    is_backfill = table.Column<bool>(type: "boolean", nullable: false),
                    source_key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_watch_events", x => x.id);
                    table.ForeignKey(
                        name: "fk_watch_events_episodes_episode_id",
                        column: x => x.episode_id,
                        principalTable: "episodes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "users",
                columns: new[] { "id", "created_at", "display_name", "email" },
                values: new object[] { new Guid("00000000-0000-0000-0000-000000000001"), new DateTimeOffset(new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), "Reprise", "me@reprise.local" });

            migrationBuilder.CreateIndex(
                name: "ix_episodes_is_special",
                table: "episodes",
                column: "is_special");

            migrationBuilder.CreateIndex(
                name: "ix_episodes_season_id",
                table: "episodes",
                column: "season_id");

            migrationBuilder.CreateIndex(
                name: "ix_episodes_series_id_season_number_episode_number",
                table: "episodes",
                columns: new[] { "series_id", "season_number", "episode_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_seasons_series_id_season_number",
                table: "seasons",
                columns: new[] { "series_id", "season_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_series_tmdb_id",
                table: "series",
                column: "tmdb_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_series_tvdb_id",
                table: "series",
                column: "tvdb_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_tracked_series_series_id",
                table: "tracked_series",
                column: "series_id");

            migrationBuilder.CreateIndex(
                name: "ix_tracked_series_user_id_series_id",
                table: "tracked_series",
                columns: new[] { "user_id", "series_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_users_email",
                table: "users",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_watch_events_episode_id",
                table: "watch_events",
                column: "episode_id");

            migrationBuilder.CreateIndex(
                name: "ix_watch_events_is_backfill_watched_at",
                table: "watch_events",
                columns: new[] { "is_backfill", "watched_at" });

            migrationBuilder.CreateIndex(
                name: "ix_watch_events_user_id_episode_id",
                table: "watch_events",
                columns: new[] { "user_id", "episode_id" });

            migrationBuilder.CreateIndex(
                name: "ix_watch_events_user_id_source_key",
                table: "watch_events",
                columns: new[] { "user_id", "source_key" },
                unique: true,
                filter: "source_key IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_watch_events_user_id_watched_at",
                table: "watch_events",
                columns: new[] { "user_id", "watched_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "import_runs");

            migrationBuilder.DropTable(
                name: "series_match_overrides");

            migrationBuilder.DropTable(
                name: "tracked_series");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "watch_events");

            migrationBuilder.DropTable(
                name: "episodes");

            migrationBuilder.DropTable(
                name: "seasons");

            migrationBuilder.DropTable(
                name: "series");
        }
    }
}
