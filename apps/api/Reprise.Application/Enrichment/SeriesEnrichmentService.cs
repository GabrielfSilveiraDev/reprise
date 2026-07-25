using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Domain.Entities;

namespace Reprise.Application.Enrichment;

/// <summary>
/// Passo de enriquecimento: casa cada série pelo id do TheTVDB, substitui o nome provisório do export
/// pelos metadados do TMDB e traz o catálogo completo de episódios — inclusive os <b>não assistidos</b>,
/// que o export não tinha e sem os quais "próximo a assistir" e o percentual de progresso não existem.
///
/// Reexecutável: <c>metadata_enriched</c> marca o que já foi feito, e cada série é salva
/// individualmente, então uma queda no meio do lote não desfaz o que já entrou.
/// </summary>
public sealed class SeriesEnrichmentService
{
    /// <summary>
    /// Temporada fictícia usada só para estacionar episódios durante um reposicionamento em massa.
    /// Sem isso, renumerar em bloco esbarra no índice único (série, temporada, episódio) no meio do
    /// caminho, quando duas linhas disputam a mesma coordenada por um instante.
    /// </summary>
    private const int ParkingSeasonNumber = -1;

    private readonly IRepriseDbContext _db;
    private readonly ITmdbClient _tmdb;

    public SeriesEnrichmentService(IRepriseDbContext db, ITmdbClient tmdb)
    {
        _db = db;
        _tmdb = tmdb;
    }

    public async Task<EnrichmentReport> EnrichAsync(
        bool force = false, int? onlyTvdbId = null, IProgress<string>? progress = null,
        CancellationToken ct = default)
    {
        var query = _db.Series.AsQueryable();
        if (!force) query = query.Where(s => !s.MetadataEnriched);
        if (onlyTvdbId is int only) query = query.Where(s => s.TvdbId == only);

        var series = await query.OrderBy(s => s.Id).ToListAsync(ct);
        var overrides = await _db.SeriesMatchOverrides.ToDictionaryAsync(o => o.TvdbId, o => o.TmdbId, ct);

        var unmatched = new List<UnmatchedSeries>();
        var orderAligned = new List<OrderAlignedSeries>();
        int matched = 0, seasonsCreated = 0, episodesCreated = 0, episodesUpdated = 0, episodesRenumbered = 0;
        int runtimesFilled = 0, notFound = 0;

        foreach (var s in series)
        {
            ct.ThrowIfCancellationRequested();
            progress?.Report($"{s.TvdbId} {s.Name}");

            if (s.TvdbId is not int tvdbId)
            {
                unmatched.Add(new UnmatchedSeries(s.Id, null, s.Name, "sem tvdb_id no export"));
                continue;
            }

            TmdbShow? show;
            try
            {
                show = overrides.TryGetValue(tvdbId, out var forcedTmdbId)
                    ? await _tmdb.GetShowAsync(forcedTmdbId, ct)
                    : await _tmdb.FindShowByTvdbIdAsync(tvdbId, ct);
            }
            catch (Exception ex)
            {
                // Falha de rede numa série não pode derrubar as outras 115.
                unmatched.Add(new UnmatchedSeries(s.Id, tvdbId, s.Name, $"erro ao consultar o TMDB: {ex.Message}"));
                continue;
            }

            if (show is null)
            {
                unmatched.Add(new UnmatchedSeries(s.Id, tvdbId, s.Name, "TMDB não encontrou nada para este tvdb_id"));
                continue;
            }

            var result = await ApplyAsync(s, show, ct);
            matched++;
            if (result.OrderAligned is { } a) orderAligned.Add(a);
            seasonsCreated += result.SeasonsCreated;
            episodesCreated += result.EpisodesCreated;
            episodesUpdated += result.EpisodesUpdated;
            episodesRenumbered += result.EpisodesRenumbered;
            runtimesFilled += result.RuntimesFilled;
            notFound += result.EpisodesNotFoundInTmdb;
        }

        return new EnrichmentReport(
            series.Count, matched, seasonsCreated, episodesCreated, episodesUpdated, episodesRenumbered,
            runtimesFilled, notFound, unmatched, orderAligned);
    }

    private sealed record ApplyResult(
        int SeasonsCreated, int EpisodesCreated, int EpisodesUpdated, int EpisodesRenumbered,
        int RuntimesFilled, int EpisodesNotFoundInTmdb, OrderAlignedSeries? OrderAligned);

    private async Task<ApplyResult> ApplyAsync(Series s, TmdbShow show, CancellationToken ct)
    {
        var remote = await _tmdb.GetEpisodesAsync(show.TmdbId, ct);

        var localEpisodes = await _db.Episodes.Where(e => e.SeriesId == s.Id).ToListAsync(ct);
        var localSeasons = await _db.Seasons.Where(x => x.SeriesId == s.Id).ToListAsync(ct);

        var plan = CatalogMerger.Plan(
            localEpisodes.Select(e => new ExistingEpisode(e.Id, e.SeasonNumber, e.EpisodeNumber, e.RuntimeSeconds, e.RuntimeEstimated)),
            localSeasons.Select(x => x.SeasonNumber),
            remote.Select(r => new TmdbEpisodeInput(r.TmdbId, r.SeasonNumber, r.EpisodeNumber, r.Name, r.AirDate, r.RuntimeSeconds)),
            show.AverageRuntimeSeconds);

        // O nome do export é provisório e vem em idiomas misturados — o TMDB manda.
        // O título em inglês só é buscado quando o original não é legível em alfabeto latino.
        var englishName = SeriesNamePolicy.IsLatinScript(show.OriginalName)
            ? null
            : await _tmdb.GetEnglishNameAsync(show.TmdbId, ct);

        s.TmdbId = show.TmdbId;
        s.Name = SeriesNamePolicy.Choose(show.OriginalName, englishName, fallback: show.Name);
        s.OriginalName = show.OriginalName;
        s.Overview = show.Overview;
        s.PosterPath = show.PosterPath;
        s.FirstAirDate = show.FirstAirDate;
        s.Status = show.Status;
        s.FallbackRuntimeSeconds = plan.EffectiveAverageRuntimeSeconds;
        s.MetadataEnriched = true;
        s.UpdatedAt = DateTimeOffset.UtcNow;

        var seasonByNumber = localSeasons.ToDictionary(x => x.SeasonNumber);
        foreach (var number in plan.SeasonsToCreate)
        {
            var season = new Season { SeriesId = s.Id, SeasonNumber = number };
            _db.Seasons.Add(season);
            seasonByNumber[number] = season;
        }
        if (plan.SeasonsToCreate.Count > 0) await _db.SaveChangesAsync(ct); // materializa os ids das temporadas

        var byId = localEpisodes.ToDictionary(e => e.Id);

        if (plan.EpisodeRenumbers.Count > 0)
            await RenumberAsync(plan.EpisodeRenumbers, byId, seasonByNumber, ct);

        foreach (var u in plan.EpisodeUpdates)
        {
            var e = byId[u.EpisodeId];
            e.TmdbId = u.TmdbId;
            e.Name = u.Name;
            e.AirDate = u.AirDate;
            e.RuntimeSeconds = u.RuntimeSeconds;
            e.RuntimeEstimated = u.RuntimeEstimated;
        }

        foreach (var c in plan.EpisodesToCreate)
        {
            _db.Episodes.Add(new Episode
            {
                SeriesId = s.Id,
                SeasonId = seasonByNumber[c.SeasonNumber].Id,
                TmdbId = c.TmdbId,
                SeasonNumber = c.SeasonNumber,
                EpisodeNumber = c.EpisodeNumber,
                Name = c.Name,
                AirDate = c.AirDate,
                RuntimeSeconds = c.RuntimeSeconds,
                RuntimeEstimated = c.RuntimeEstimated,
                IsSpecial = c.IsSpecial
            });
        }

        await _db.SaveChangesAsync(ct);

        return new ApplyResult(
            plan.SeasonsToCreate.Count, plan.EpisodesToCreate.Count, plan.EpisodeUpdates.Count,
            plan.EpisodeRenumbers.Count, plan.RuntimesFilled, plan.EpisodesNotFoundInTmdb,
            plan.AlignedByOrder
                ? new OrderAlignedSeries(
                    s.Id, s.TvdbId, s.Name, localEpisodes.Count,
                    plan.EpisodeRenumbers.Count, plan.EpisodesNotFoundInTmdb)
                : null);
    }

    /// <summary>
    /// Aplica o reposicionamento em duas fases. A primeira estaciona todo mundo numa temporada
    /// fictícia com números distintos; só então a segunda grava as coordenadas finais. Fazer direto
    /// violaria o índice único no meio do lote — o episódio A quer a coordenada que o B ainda ocupa.
    /// </summary>
    private async Task RenumberAsync(
        IReadOnlyList<EpisodeRenumber> renumbers, Dictionary<long, Episode> byId,
        Dictionary<int, Season> seasonByNumber, CancellationToken ct)
    {
        for (var i = 0; i < renumbers.Count; i++)
        {
            var e = byId[renumbers[i].EpisodeId];
            e.SeasonNumber = ParkingSeasonNumber;
            e.EpisodeNumber = -(i + 1);
        }
        await _db.SaveChangesAsync(ct);

        foreach (var r in renumbers)
        {
            var e = byId[r.EpisodeId];
            e.SeasonNumber = r.NewSeasonNumber;
            e.EpisodeNumber = r.NewEpisodeNumber;
            e.SeasonId = seasonByNumber[r.NewSeasonNumber].Id;
            e.IsSpecial = r.NewSeasonNumber == 0;
            e.TmdbId = r.TmdbId;
            e.Name = r.Name;
            e.AirDate = r.AirDate;
            e.RuntimeSeconds = r.RuntimeSeconds;
            e.RuntimeEstimated = r.RuntimeEstimated;
        }
        await _db.SaveChangesAsync(ct);
    }
}
