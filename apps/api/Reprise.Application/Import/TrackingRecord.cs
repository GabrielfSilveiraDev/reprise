using System.Globalization;

namespace Reprise.Application.Import;

public enum RecordType
{
    Unknown = 0,
    /// <summary><c>watch-episode-&lt;s&gt;-&lt;e&gt;</c> — primeira exibição de um episódio.</summary>
    Watch,
    /// <summary><c>rewatch-episode-&lt;s&gt;-&lt;e&gt;-&lt;n&gt;</c> — n-ésima revisão.</summary>
    Rewatch,
    /// <summary><c>user-series-&lt;s&gt;</c> — estado da série.</summary>
    UserSeries,
    /// <summary><c>tracking-stats</c> — linha única de agregados (conferência).</summary>
    Stats
}

/// <summary>
/// Uma linha crua do <c>tracking-prod-records-v2.csv</c>. Os campos vêm como texto (tolerante a vazios)
/// e são interpretados pelas propriedades derivadas. O tipo da linha é discriminado pela coluna <see cref="Key"/>.
/// </summary>
public sealed class TrackingRecord
{
    public string Key { get; set; } = string.Empty;
    public string? SId { get; set; }
    public string? Runtime { get; set; }
    public string? SNo { get; set; }
    public string? EpNo { get; set; }
    public string? SeasonNumber { get; set; }
    public string? EpisodeNumber { get; set; }
    public string? CreatedAt { get; set; }
    public string? BulkType { get; set; }
    public string? SeriesName { get; set; }

    // Campos de user-series
    public string? IsFollowed { get; set; }
    public string? IsArchived { get; set; }
    public string? IsForLater { get; set; }
    public string? FollowedAt { get; set; }

    // Campos de tracking-stats
    public string? SeriesFollowCount { get; set; }
    public string? EpWatchCount { get; set; }
    public string? TotalSeriesRuntime { get; set; }

    // ---- Derivados ----

    public RecordType Type =>
        Key.StartsWith("rewatch-episode-", StringComparison.Ordinal) ? RecordType.Rewatch
        : Key.StartsWith("watch-episode-", StringComparison.Ordinal) ? RecordType.Watch
        : Key.StartsWith("user-series-", StringComparison.Ordinal) ? RecordType.UserSeries
        : Key == "tracking-stats" ? RecordType.Stats
        : RecordType.Unknown;

    public bool IsExhibition => Type is RecordType.Watch or RecordType.Rewatch;

    /// <summary>
    /// UUID da série embutido na <see cref="Key"/> — liga uma linha <c>user-series</c> às exibições
    /// da mesma série (as três compartilham o mesmo uuid), útil quando o <c>s_id</c> não vem na linha.
    /// </summary>
    public string? SeriesUuid
    {
        get
        {
            const string w = "watch-episode-", rw = "rewatch-episode-", us = "user-series-";
            return Type switch
            {
                RecordType.Watch when Key.Length >= w.Length + 36 => Key.Substring(w.Length, 36),
                RecordType.Rewatch when Key.Length >= rw.Length + 36 => Key.Substring(rw.Length, 36),
                RecordType.UserSeries when Key.Length > us.Length => Key[us.Length..],
                _ => null
            };
        }
    }

    public int? TvdbId => ParseInt(SId);

    /// <summary>Prefere <c>s_no</c>, cai para <c>season_number</c>.</summary>
    public int? SeasonNo => ParseInt(SNo) ?? ParseInt(SeasonNumber);

    /// <summary>Prefere <c>ep_no</c>, cai para <c>episode_number</c>.</summary>
    public int? EpisodeNo => ParseInt(EpNo) ?? ParseInt(EpisodeNumber);

    /// <summary>Runtime em segundos, ou null quando o export vem vazio (a preencher pelo TMDB).</summary>
    public int? RuntimeSeconds => ParseInt(Runtime);

    /// <summary>Especial = temporada 0. A coluna <c>is_special</c> do export é ignorada (inconfiável).</summary>
    public bool IsSpecial => SeasonNo == 0;

    /// <summary>
    /// Backfill: marcação em massa que herdou a data da importação, não da exibição real.
    /// Vale para <c>bulk_type</c> = <c>season</c> ou <c>fill-previous</c>.
    /// </summary>
    public bool IsBackfill => BulkType is "season" or "fill-previous";

    /// <summary>Data da exibição (<c>created_at</c>, "yyyy-MM-dd HH:mm:ss", assumida em UTC).</summary>
    public DateTimeOffset? WatchedAt =>
        DateTime.TryParseExact(CreatedAt, "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var dt)
            ? new DateTimeOffset(dt, TimeSpan.Zero)
            : null;

    /// <summary><c>followed_at</c> vem em MICROSSEGUNDOS desde o epoch (não ms).</summary>
    public DateTimeOffset? FollowedAtUtc =>
        long.TryParse(FollowedAt, NumberStyles.Integer, CultureInfo.InvariantCulture, out var micros) && micros > 0
            ? DateTimeOffset.UnixEpoch.AddMicroseconds(micros)
            : null;

    public bool AsBool(string? v) => string.Equals(v, "true", StringComparison.OrdinalIgnoreCase);

    private static int? ParseInt(string? v) =>
        int.TryParse(v, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) ? n : null;

    public long? StatSeriesFollowCount => ParseLong(SeriesFollowCount);
    public long? StatEpWatchCount => ParseLong(EpWatchCount);
    public long? StatTotalSeriesRuntime => ParseLong(TotalSeriesRuntime);

    private static long? ParseLong(string? v) =>
        long.TryParse(v, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) ? n : null;
}
