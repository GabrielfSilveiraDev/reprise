using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Application.Enrichment;
using Reprise.Application.Features.Series;
using Reprise.Domain.Entities;
using Reprise.Domain.Enums;

namespace Reprise.Tests.Integration;

/// <summary>
/// A prévia de uma série do TMDB, o que a busca mostra ao tocar num resultado: montada do TMDB
/// (falso aqui) e cruzada com o acervo de quem pergunta, sem gravar nada.
/// </summary>
public sealed class SeriesPreviewTests : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private static readonly DateOnly Hoje = new(2026, 10, 20);

    private readonly PostgresFixture _pg;
    private readonly Guid _eu = Guid.NewGuid();
    private readonly TmdbFalso _tmdb = new();

    public SeriesPreviewTests(PostgresFixture pg) => _pg = pg;

    public async Task InitializeAsync()
    {
        await using var db = _pg.CreateContext(_eu);
        await db.Database.ExecuteSqlRawAsync(
            "TRUNCATE watch_events, tracked_series, episodes, seasons, series RESTART IDENTITY CASCADE");

        _tmdb.Shows[105248] = new TmdbShow(105248, "Cyberpunk: Mercenários", "サイバーパンク エッジランナーズ",
            "Num futuro distópico…", "/poster.jpg", new DateOnly(2022, 9, 13), "Returning Series", 1500, "JP");
        _tmdb.English[105248] = "Cyberpunk: Edgerunners";
        _tmdb.Episodios[105248] =
        [
            new TmdbEpisode(1, 0, 1, "Especial", new DateOnly(2022, 8, 1), null),
            new TmdbEpisode(2, 1, 1, "Deixe você", new DateOnly(2022, 9, 13), 1500),
            new TmdbEpisode(3, 1, 2, "Como um rapaz", new DateOnly(2022, 9, 13), 1500),
            new TmdbEpisode(4, 2, 1, "Episódio 1", new DateOnly(2026, 10, 20), 1500),
            new TmdbEpisode(5, 2, 2, "Episódio 2", new DateOnly(2026, 10, 27), 1500),
        ];
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Monta_temporadas_sem_especiais_o_proximo_episodio_e_o_nome_da_politica()
    {
        var previa = await PreviewAsync(105248);

        Assert.NotNull(previa);
        // Título original em japonês não é legível em alfabeto latino: vale o inglês, como no
        // enriquecimento — a série não muda de nome ao ser adicionada.
        Assert.Equal("Cyberpunk: Edgerunners", previa.Name);
        Assert.Equal(25, previa.AverageRuntimeMinutes);
        Assert.Equal(
            [new SeasonPreviewDto(1, 2, new DateOnly(2022, 9, 13), new DateOnly(2022, 9, 13)),
             new SeasonPreviewDto(2, 2, new DateOnly(2026, 10, 20), new DateOnly(2026, 10, 27))],
            previa.Seasons);
        // Hoje conta como "próximo": o episódio que sai hoje ainda é o que se espera.
        Assert.Equal(Hoje, previa.NextAirDate);
        Assert.Null(previa.SeriesId);
        Assert.Null(previa.TrackedStatus);
    }

    [Fact]
    public async Task Diz_se_a_serie_ja_esta_no_acervo_de_quem_pergunta()
    {
        await using (var db = _pg.CreateContext(_eu))
        {
            var serie = new Series { Name = "Cyberpunk: Edgerunners", TmdbId = 105248, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            db.Series.Add(serie);
            await db.SaveChangesAsync();
            db.TrackedSeries.Add(new TrackedSeries { UserId = _eu, SeriesId = serie.Id, Status = SeriesStatus.Finished, AddedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync();
        }

        var minha = await PreviewAsync(105248);
        Assert.NotNull(minha?.SeriesId);
        Assert.Equal("Finished", minha.TrackedStatus);

        // Outra pessoa vê a série no catálogo (que é global), mas não como acompanhada por ela.
        var deOutro = await PreviewAsync(105248, Guid.NewGuid());
        Assert.Equal(minha.SeriesId, deOutro?.SeriesId);
        Assert.Null(deOutro?.TrackedStatus);
    }

    [Fact]
    public async Task Id_que_o_TMDB_nao_conhece_e_nulo_e_nada_e_gravado()
    {
        Assert.Null(await PreviewAsync(999));

        await PreviewAsync(105248);
        await using var db = _pg.CreateContext(_eu);
        Assert.Equal(0, await db.Series.CountAsync());
    }

    private async Task<SeriesPreviewDto?> PreviewAsync(int tmdbId, Guid? usuario = null)
    {
        var quem = usuario ?? _eu;
        await using var db = _pg.CreateContext(quem);
        var servico = new SeriesCatalogService(db, _tmdb, new PostgresFixture.FixedUser(quem), new SeriesEnrichmentService(db, _tmdb));
        return await servico.PreviewAsync(tmdbId, Hoje);
    }

    private sealed class TmdbFalso : ITmdbClient
    {
        public Dictionary<int, TmdbShow> Shows { get; } = [];
        public Dictionary<int, List<TmdbEpisode>> Episodios { get; } = [];
        public Dictionary<int, string> English { get; } = [];

        public Task<TmdbShow?> GetShowAsync(int tmdbId, CancellationToken cancellationToken = default) =>
            Task.FromResult(Shows.GetValueOrDefault(tmdbId));

        public Task<IReadOnlyList<TmdbEpisode>> GetEpisodesAsync(int tmdbId, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<TmdbEpisode>>(Episodios.GetValueOrDefault(tmdbId) ?? []);

        public Task<string?> GetEnglishNameAsync(int tmdbId, CancellationToken cancellationToken = default) =>
            Task.FromResult(English.GetValueOrDefault(tmdbId));

        public Task<TmdbShow?> FindShowByTvdbIdAsync(int tvdbId, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<TmdbSearchHit>> SearchShowsAsync(string query, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task WarmUpAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}
