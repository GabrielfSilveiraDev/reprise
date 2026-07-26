using Microsoft.EntityFrameworkCore;
using Npgsql;
using Reprise.Application.Abstractions;
using Reprise.Application.Features.Stats;

namespace Reprise.Infrastructure.Persistence;

/// <summary>
/// As agregações de estatística, em SQL.
///
/// ATENÇÃO À MULTI-TENANCY: o query filter global do EF Core <b>não</b> alcança SQL cru. Todo
/// comando aqui filtra <c>user_id</c> explicitamente, e é por isso que o parâmetro nunca é
/// opcional. Esquecer um deles vazaria dados entre usuários quando o app deixar de ser single-user.
/// </summary>
public sealed class StatsQueries : IStatsQueries
{
    private readonly RepriseDbContext _db;
    private readonly ICurrentUser _currentUser;

    public StatsQueries(RepriseDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    /// <summary>
    /// <b>Contagem: tudo entra.</b>
    ///
    /// <c>is_backfill</c> diz que a DATA é duvidosa, não que a exibição seja falsa — vem de
    /// <c>bulk_type</c> = <c>season</c>/<c>fill-previous</c>, ou seja, o episódio foi marcado
    /// junto com a temporada inteira e herdou a data do lote. Quem assistiu, assistiu.
    ///
    /// Estas consultas já responderam "quantos episódios" descartando backfill, e o resultado era
    /// 60 exibições em 10 séries para quem tem 10.451 em 115. Perguntas de contagem não dependem
    /// de quando aconteceu, então não têm por que consultar a confiabilidade da data.
    /// </summary>
    private const string CountingFrom = """
        FROM watch_events w
        JOIN episodes e ON e.id = w.episode_id
        WHERE w.user_id = @user_id
        """;

    /// <summary>
    /// <b>Linha do tempo: o backfill fica de fora por padrão.</b>
    ///
    /// Aqui a data é o eixo, e a data do backfill é a do lote: 9.995 das exibições caem todas em
    /// 29/12/2025, o dia da importação. Incluí-las desenharia um pico que nunca houve e uma
    /// sequência de dias que ninguém cumpriu. O parâmetro existe para quem quiser ver assim mesmo,
    /// mas o padrão é a linha do tempo honesta.
    /// </summary>
    private const string TimelineFrom = $"""
        {CountingFrom}
          AND (@include_backfill OR NOT w.is_backfill)
        """;

    private async Task<NpgsqlCommand> CommandAsync(string sql, bool includeBackfill, CancellationToken ct)
    {
        var connection = (NpgsqlConnection)_db.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
            await connection.OpenAsync(ct);

        var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("user_id", _currentUser.UserId);
        command.Parameters.AddWithValue("include_backfill", includeBackfill);
        return command;
    }

    public async Task<StatsOverviewDto> GetOverviewAsync(bool includeBackfill, CancellationToken ct = default)
    {
        // Note quem recebe `includeBackfill` e quem não recebe: só as visões com eixo de tempo.
        // O resumo e o top de séries contam o acervo inteiro, sempre.
        var summary = await SummaryAsync(ct);
        var byYear = await BucketsAsync("year", "YYYY", includeBackfill, ct);
        var byMonth = await BucketsAsync("month", "YYYY-MM", includeBackfill, ct);
        var top = await TopSeriesAsync(ct);
        var streaks = await StreaksAsync(includeBackfill, ct);
        var years = byYear.Select(b => int.Parse(b.Label)).OrderByDescending(y => y).ToList();

        return new StatsOverviewDto(summary, byYear, byMonth, top, streaks, years);
    }

    private async Task<StatsSummaryDto> SummaryAsync(CancellationToken ct)
    {
        var sql = $"""
            SELECT
              count(*)                                   AS exhibitions,
              count(DISTINCT w.episode_id)               AS distinct_episodes,
              count(DISTINCT e.series_id)                AS series_count,
              coalesce(sum(e.runtime_seconds), 0)::bigint AS total_seconds,
              -- Quantas dessas exibições têm data de lote. Não desconta nada do que está acima —
              -- serve para a tela explicar por que a linha do tempo mostra menos que o total.
              count(*) FILTER (WHERE w.is_backfill)      AS backfill_exhibitions,
              min(w.watched_at)                          AS first_at,
              max(w.watched_at)                          AS last_at
            {CountingFrom}
            """;

        await using var command = await CommandAsync(sql, includeBackfill: true, ct);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
            return new StatsSummaryDto(0, 0, 0, 0, 0, 0, null, null);

        var exhibitions = (int)reader.GetInt64(0);
        var distinct = (int)reader.GetInt64(1);

        // Taxa de rewatch = quanto das exibições foi revisita, não estreia.
        var rewatchRate = exhibitions == 0 ? 0d : (double)(exhibitions - distinct) / exhibitions;

        return new StatsSummaryDto(
            exhibitions,
            distinct,
            (int)reader.GetInt64(2),
            reader.GetInt64(3),
            (int)reader.GetInt64(4),
            rewatchRate,
            reader.IsDBNull(5) ? null : reader.GetFieldValue<DateTimeOffset>(5),
            reader.IsDBNull(6) ? null : reader.GetFieldValue<DateTimeOffset>(6));
    }

    private async Task<IReadOnlyList<TimeBucketDto>> BucketsAsync(
        string granularity, string labelFormat, bool includeBackfill, CancellationToken ct)
    {
        // `granularity` e `labelFormat` são constantes do próprio código, nunca entrada de usuário.
        var sql = $"""
            SELECT to_char(date_trunc('{granularity}', w.watched_at), '{labelFormat}') AS label,
                   count(*)                                    AS exhibitions,
                   coalesce(sum(e.runtime_seconds), 0)::bigint AS seconds
            {TimelineFrom}
            GROUP BY 1
            ORDER BY 1
            """;

        await using var command = await CommandAsync(sql, includeBackfill, ct);
        await using var reader = await command.ExecuteReaderAsync(ct);

        var result = new List<TimeBucketDto>();
        while (await reader.ReadAsync(ct))
            result.Add(new TimeBucketDto(reader.GetString(0), (int)reader.GetInt64(1), reader.GetInt64(2)));
        return result;
    }

    /// <summary>
    /// As séries a que você mais dedicou tempo. Contagem, não linha do tempo: entra tudo.
    ///
    /// Era aqui que a distorção mais aparecia — sem o backfill, o ranking listava as poucas séries
    /// tocadas depois da importação, e não aquelas em que o tempo de fato foi gasto.
    /// </summary>
    private async Task<IReadOnlyList<TopSeriesDto>> TopSeriesAsync(CancellationToken ct)
    {
        // Esta é a única que precisa de series na junção, então não reusa CountingFrom.
        const string sql = """
            SELECT s.id, s.name,
                   count(*)                                    AS exhibitions,
                   count(DISTINCT w.episode_id)                AS distinct_episodes,
                   coalesce(sum(e.runtime_seconds), 0)::bigint AS seconds
            FROM watch_events w
            JOIN episodes e ON e.id = w.episode_id
            JOIN series s ON s.id = e.series_id
            WHERE w.user_id = @user_id
            GROUP BY s.id, s.name
            ORDER BY seconds DESC
            LIMIT 15
            """;

        await using var command = await CommandAsync(sql, includeBackfill: true, ct);
        await using var reader = await command.ExecuteReaderAsync(ct);

        var result = new List<TopSeriesDto>();
        while (await reader.ReadAsync(ct))
            result.Add(new TopSeriesDto(
                reader.GetInt64(0), reader.GetString(1),
                (int)reader.GetInt64(2), (int)reader.GetInt64(3), reader.GetInt64(4)));
        return result;
    }

    private async Task<StreaksDto> StreaksAsync(bool includeBackfill, CancellationToken ct)
    {
        // O banco só entrega os dias distintos; a regra de sequência é do StreakCalculator.
        var sql = $"""
            SELECT DISTINCT (w.watched_at AT TIME ZONE 'UTC')::date AS day
            {TimelineFrom}
            ORDER BY day
            """;

        await using var command = await CommandAsync(sql, includeBackfill, ct);
        await using var reader = await command.ExecuteReaderAsync(ct);

        var days = new List<DateOnly>();
        while (await reader.ReadAsync(ct))
            days.Add(DateOnly.FromDateTime(reader.GetDateTime(0)));

        return StreakCalculator.Compute(days, DateOnly.FromDateTime(DateTime.UtcNow));
    }

    public async Task<IReadOnlyList<CalendarDayDto>> GetCalendarAsync(
        int year, bool includeBackfill, CancellationToken ct = default)
    {
        var sql = $"""
            SELECT (w.watched_at AT TIME ZONE 'UTC')::date        AS day,
                   count(*)                                       AS exhibitions,
                   coalesce(sum(e.runtime_seconds), 0)::bigint    AS seconds
            {TimelineFrom}
              AND date_part('year', w.watched_at AT TIME ZONE 'UTC') = @year
            GROUP BY 1
            ORDER BY 1
            """;

        await using var command = await CommandAsync(sql, includeBackfill, ct);
        command.Parameters.AddWithValue("year", year);
        await using var reader = await command.ExecuteReaderAsync(ct);

        var result = new List<CalendarDayDto>();
        while (await reader.ReadAsync(ct))
            result.Add(new CalendarDayDto(
                DateOnly.FromDateTime(reader.GetDateTime(0)), (int)reader.GetInt64(1), reader.GetInt64(2)));
        return result;
    }
}
