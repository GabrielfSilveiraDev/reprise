using Microsoft.EntityFrameworkCore;
using Reprise.Application.Abstractions;
using Reprise.Application.Enrichment;
using Reprise.Domain.Entities;
using Reprise.Domain.Enums;
using Reprise.Infrastructure.Catalog;
using Reprise.Infrastructure.Tvmaze;

namespace Reprise.Tests.Integration;

/// <summary>
/// A atualização automática do catálogo, contra um Postgres de verdade e com o TMDB e o TVmaze
/// falsos.
///
/// <para>
/// O que mais importa aqui é a <b>seleção</b>: ela roda sozinha, de hora em hora, sem ninguém
/// olhando. Errar para mais custa requisições à toa em séries encerradas; errar para menos é o
/// defeito que originou isto — a tela sem a temporada nova, sem ninguém saber por quê.
/// </para>
/// </summary>
public sealed class CatalogRefreshTests : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private readonly PostgresFixture _pg;

    /// <summary>Quem acompanha as séries. A atualização roda como OUTRO usuário — ver <see cref="Atualizacao"/>.</summary>
    private readonly Guid _dono = Guid.NewGuid();

    private readonly TmdbFalso _tmdb = new();
    private readonly TvmazeFalso _tvmaze = new();

    public CatalogRefreshTests(PostgresFixture pg) => _pg = pg;

    public async Task InitializeAsync()
    {
        await using var db = _pg.CreateContext(_dono);
        await db.Database.ExecuteSqlRawAsync(
            "TRUNCATE watch_events, tracked_series, episodes, seasons, series RESTART IDENTITY CASCADE");
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Atualiza_so_as_series_acompanhadas_ainda_em_producao_e_vencidas()
    {
        var agora = DateTimeOffset.UtcNow;
        var velha = agora.AddDays(-2);

        await SemearAsync(tmdbId: 1, "Em produção, vencida", "Returning Series", velha);
        await SemearAsync(tmdbId: 2, "Encerrada", "Ended", velha);
        await SemearAsync(tmdbId: 3, "Cancelada", "Canceled", velha);
        await SemearAsync(tmdbId: 4, "Arquivada", "Returning Series", velha, SeriesStatus.Archived);
        await SemearAsync(tmdbId: 5, "Atualizada há uma hora", "Returning Series", agora.AddHours(-1));
        await SemearAsync(tmdbId: null, "Nunca casada no TMDB", "In Production", velha);

        var r = await RodarAsync(agora);

        Assert.Equal([1], _tmdb.Consultadas);
        Assert.Equal(1, r.Vencidas);
        Assert.Equal(1, r.Atualizadas);
        Assert.Empty(r.Falhas);
    }

    [Fact]
    public async Task Traz_o_episodio_novo_com_resumo_e_a_data_do_TVmaze()
    {
        var serie = await SemearAsync(tmdbId: 10, "Silo", "Returning Series", DateTimeOffset.UtcNow.AddDays(-3));
        var estreia = new DateOnly(2027, 7, 8);
        _tmdb.Episodios[10] =
        [
            new TmdbEpisode(100, 1, 1, "Piloto", new DateOnly(2023, 5, 5), 3600),
            new TmdbEpisode(101, 4, 1, "O fim", estreia, null, Overview: "A última temporada."),
        ];
        _tvmaze.Episodios[10] = [new TvmazeEpisode(4, 1, estreia.AddDays(1), null, false)];

        await RodarAsync(DateTimeOffset.UtcNow);

        await using var db = _pg.CreateContext(_dono);
        var novo = await db.Episodes.SingleAsync(e => e.SeriesId == serie && e.SeasonNumber == 4);
        Assert.Equal("A última temporada.", novo.Overview);
        Assert.Equal(estreia, novo.AirDate);
        // A Apple TV sai um dia depois no TVmaze — e é a data dele que decide o "estreia amanhã".
        Assert.Equal(estreia.AddDays(1), novo.TvmazeAirDate);
        Assert.Equal(10, (await db.Series.SingleAsync(s => s.Id == serie)).TvmazeId);
    }

    [Fact]
    public async Task Falha_numa_serie_nao_impede_as_outras_e_ela_continua_vencida()
    {
        var velha = DateTimeOffset.UtcNow.AddDays(-2);
        var quebrada = await SemearAsync(tmdbId: 20, "Quebrada", "Returning Series", velha);
        var boa = await SemearAsync(tmdbId: 21, "Boa", "Returning Series", velha);
        _tmdb.Quebradas.Add(20);

        var r = await RodarAsync(DateTimeOffset.UtcNow);

        Assert.Equal(2, r.Vencidas);
        Assert.Equal(1, r.Atualizadas);
        Assert.Contains("Quebrada", Assert.Single(r.Falhas));

        await using var db = _pg.CreateContext(_dono);
        Assert.True((await db.Series.SingleAsync(s => s.Id == boa)).UpdatedAt > velha);
        // Não avançou o marco: a próxima rodada tenta de novo.
        Assert.Equal(velha.ToUnixTimeSeconds(), (await db.Series.SingleAsync(s => s.Id == quebrada)).UpdatedAt.ToUnixTimeSeconds());
    }

    [Fact]
    public async Task A_rodada_seguinte_nao_repete_o_que_acabou_de_atualizar()
    {
        await SemearAsync(tmdbId: 30, "Semanal", "Returning Series", DateTimeOffset.UtcNow.AddDays(-1));

        Assert.Equal(1, (await RodarAsync(DateTimeOffset.UtcNow)).Atualizadas);

        // É a validade, e não o intervalo do serviço, que decide quando volta a consultar: uma
        // hora depois a série ainda está em dia, então o TMDB não é chamado de novo.
        var outra = await RodarAsync(DateTimeOffset.UtcNow.AddHours(1));
        Assert.Equal(0, outra.Vencidas);
        Assert.Single(_tmdb.Consultadas);
    }

    // ---- montagem ---------------------------------------------------------------------------

    /// <summary>
    /// A atualização roda como um usuário que não acompanha nada — é o que acontece na API, onde o
    /// serviço em segundo plano não tem requisição e o tenant é o id vazio. Se a seleção dependesse
    /// do filtro de tenant, nada seria atualizado, e estes testes pegariam isso.
    /// </summary>
    private async Task<CatalogRefreshReport> RodarAsync(DateTimeOffset agora)
    {
        await using var db = _pg.CreateContext(Guid.Empty);
        var atualizacao = new CatalogRefresh(
            db, _tmdb, new SeriesEnrichmentService(db, _tmdb), new TvmazeScheduleSync(db, _tvmaze));
        return await atualizacao.RefreshStaleAsync(agora);
    }

    /// <summary>
    /// Uma série com um episódio (T1E1) e o TMDB/TVmaze falsos já sabendo dela. Os ids das duas
    /// fontes são o próprio <paramref name="tmdbId"/>, para os testes não terem de carregar tabela.
    /// </summary>
    private async Task<long> SemearAsync(
        int? tmdbId, string nome, string producao, DateTimeOffset atualizadaEm,
        SeriesStatus relacao = SeriesStatus.Following)
    {
        await using var db = _pg.CreateContext(_dono);

        var serie = new Series
        {
            Name = nome, TmdbId = tmdbId, TvdbId = tmdbId, Status = producao, MetadataEnriched = true,
            CreatedAt = atualizadaEm, UpdatedAt = atualizadaEm,
        };
        db.Series.Add(serie);
        await db.SaveChangesAsync();

        var temporada = new Season { SeriesId = serie.Id, SeasonNumber = 1 };
        db.Seasons.Add(temporada);
        await db.SaveChangesAsync();

        db.Episodes.Add(new Episode
        {
            SeriesId = serie.Id, SeasonId = temporada.Id, SeasonNumber = 1, EpisodeNumber = 1,
            Name = "Piloto", AirDate = new DateOnly(2023, 5, 5),
        });
        db.TrackedSeries.Add(new TrackedSeries
        {
            UserId = _dono, SeriesId = serie.Id, Status = relacao, AddedAt = atualizadaEm,
        });
        await db.SaveChangesAsync();

        if (tmdbId is int id)
        {
            _tmdb.Shows[id] = new TmdbShow(id, nome, nome, null, null, new DateOnly(2023, 5, 5), producao, 3600, "US");
            _tmdb.Episodios.TryAdd(id, [new TmdbEpisode(id * 10, 1, 1, "Piloto", new DateOnly(2023, 5, 5), 3600)]);
            _tvmaze.Episodios.TryAdd(id, []);
        }

        return serie.Id;
    }

    /// <summary>O TMDB, com o que cada teste diz que ele sabe. Registra quem foi consultado.</summary>
    private sealed class TmdbFalso : ITmdbClient
    {
        public Dictionary<int, TmdbShow> Shows { get; } = [];
        public Dictionary<int, List<TmdbEpisode>> Episodios { get; } = [];
        public HashSet<int> Quebradas { get; } = [];
        public List<int> Consultadas { get; } = [];

        public Task<TmdbShow?> GetShowAsync(int tmdbId, CancellationToken cancellationToken = default)
        {
            Consultadas.Add(tmdbId);
            if (Quebradas.Contains(tmdbId)) throw new HttpRequestException("TMDB fora do ar");
            return Task.FromResult(Shows.GetValueOrDefault(tmdbId));
        }

        public Task<IReadOnlyList<TmdbEpisode>> GetEpisodesAsync(int tmdbId, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<TmdbEpisode>>(Episodios[tmdbId]);

        public Task<string?> GetEnglishNameAsync(int tmdbId, CancellationToken cancellationToken = default) =>
            Task.FromResult<string?>(null);

        // A atualização vai direto pelo id do TMDB que a série já tem. Recasar pelo TheTVDB seria
        // uma requisição a mais por série — e o risco de trocar o casamento que alguém corrigiu à mão.
        public Task<TmdbShow?> FindShowByTvdbIdAsync(int tvdbId, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("a atualização não deveria recasar a série");

        public Task<IReadOnlyList<TmdbSearchHit>> SearchShowsAsync(string query, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task WarmUpAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    /// <summary>O TVmaze: casa pelo id do TheTVDB, que nos testes é igual ao do TMDB e ao do TVmaze.</summary>
    private sealed class TvmazeFalso : ITvmazeClient
    {
        public Dictionary<int, List<TvmazeEpisode>> Episodios { get; } = [];

        public Task<TvmazeShow?> FindByTvdbIdAsync(int tvdbId, CancellationToken cancellationToken = default) =>
            Task.FromResult(Episodios.ContainsKey(tvdbId) ? new TvmazeShow(tvdbId, $"TVmaze {tvdbId}", 2023, "Apple TV") : null);

        public Task<TvmazeShow?> SearchByNameAsync(string name, CancellationToken cancellationToken = default) =>
            Task.FromResult<TvmazeShow?>(null);

        public Task<IReadOnlyList<TvmazeEpisode>> GetEpisodesAsync(int tvmazeId, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<TvmazeEpisode>>(Episodios[tvmazeId]);

        public Task<IReadOnlyDictionary<int, DateTimeOffset>> GetUpdatedSinceAsync(
            string since = "week", CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyDictionary<int, DateTimeOffset>>(new Dictionary<int, DateTimeOffset>());
    }
}
