using System.Globalization;
using System.IO.Compression;
using CsvHelper;
using CsvHelper.Configuration;

namespace Reprise.Application.Import;

/// <summary>Lê o <c>tracking-prod-records-v2.csv</c> do export do TV Time em <see cref="TrackingRecord"/>s.</summary>
public sealed class TvTimeExportReader
{
    private sealed class Map : ClassMap<TrackingRecord>
    {
        public Map()
        {
            Map(m => m.Key).Name("key");
            Map(m => m.SId).Name("s_id");
            Map(m => m.Runtime).Name("runtime");
            Map(m => m.SNo).Name("s_no");
            Map(m => m.EpNo).Name("ep_no");
            Map(m => m.SeasonNumber).Name("season_number");
            Map(m => m.EpisodeNumber).Name("episode_number");
            Map(m => m.CreatedAt).Name("created_at");
            Map(m => m.BulkType).Name("bulk_type");
            Map(m => m.SeriesName).Name("series_name");
            Map(m => m.IsFollowed).Name("is_followed");
            Map(m => m.IsArchived).Name("is_archived");
            Map(m => m.IsForLater).Name("is_for_later");
            Map(m => m.FollowedAt).Name("followed_at");
            Map(m => m.SeriesFollowCount).Name("series_follow_count");
            Map(m => m.EpWatchCount).Name("ep_watch_count");
            Map(m => m.TotalSeriesRuntime).Name("total_series_runtime");
        }
    }

    public IReadOnlyList<TrackingRecord> Read(TextReader reader)
    {
        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HeaderValidated = null,   // colunas ausentes no header não invalidam
            MissingFieldFound = null, // campos ausentes viram null em vez de exceção
            BadDataFound = null
        };
        using var csv = new CsvReader(reader, config);
        csv.Context.RegisterClassMap<Map>();
        return csv.GetRecords<TrackingRecord>().ToList();
    }

    public IReadOnlyList<TrackingRecord> ReadFile(string path)
    {
        using var stream = File.OpenText(path);
        return Read(stream);
    }

    /// <summary>Nome da fonte da verdade dentro do export GDPR do TV Time.</summary>
    public const string CanonicalEntryName = "tracking-prod-records-v2.csv";

    /// <summary>Lê direto do .zip do export, localizando o <see cref="CanonicalEntryName"/>.</summary>
    public IReadOnlyList<TrackingRecord> ReadZip(string zipPath)
    {
        using var archive = ZipFile.OpenRead(zipPath);
        var entry = archive.GetEntry(CanonicalEntryName)
            ?? archive.Entries.FirstOrDefault(e => e.Name.Equals(CanonicalEntryName, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException($"'{CanonicalEntryName}' não encontrado no zip '{zipPath}'.");
        using var reader = new StreamReader(entry.Open());
        return Read(reader);
    }

    /// <summary>Lê de um caminho .zip ou .csv, escolhendo pelo sufixo.</summary>
    public IReadOnlyList<TrackingRecord> ReadPath(string path) =>
        path.EndsWith(".zip", StringComparison.OrdinalIgnoreCase) ? ReadZip(path) : ReadFile(path);
}
