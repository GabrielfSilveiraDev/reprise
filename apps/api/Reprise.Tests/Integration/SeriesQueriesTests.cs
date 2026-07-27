using Microsoft.EntityFrameworkCore;
using Reprise.Application.Features.Series;
using Reprise.Domain.Entities;
using Reprise.Domain.Enums;
using Reprise.Infrastructure.Persistence;

namespace Reprise.Tests.Integration;

/// <summary>
/// A lista de séries e a fila de "próximos", contra um Postgres de verdade.
///
/// <b>Estes testes substituem os do antigo <c>ProgressCalculator</c>.</b> Aquela classe calculava
/// progresso em C# depois de trazer todos os episódios de todas as séries para a memória — 9.263
/// linhas por abertura da tela inicial. A regra migrou para o banco, e com ela a cobertura tinha
/// de migrar também: um teste puro sobre uma classe que ninguém mais chama protege código morto.
///
/// Os cinco primeiros casos são os mesmos que aquele teste cobria, agora exercidos através do SQL
/// que roda em produção. Os dois últimos cobrem o que nunca teve teste nenhum e é o que mais assusta:
/// o isolamento entre usuários e a posição dos nulos na ordenação.
/// </summary>
public sealed class SeriesQueriesTests : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private readonly PostgresFixture _pg;
    private readonly Guid _eu = Guid.NewGuid();
    private readonly Guid _outra = Guid.NewGuid();

    public SeriesQueriesTests(PostgresFixture pg) => _pg = pg;

    /// <summary>Cada teste começa de um banco limpo — ordem entre eles não pode importar.</summary>
    public async Task InitializeAsync()
    {
        await using var db = _pg.CreateContext(_eu);
        await db.Database.ExecuteSqlRawAsync(
            "TRUNCATE watch_events, tracked_series, episodes, seasons, series RESTART IDENTITY CASCADE");
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Nada_visto_o_proximo_e_o_primeiro_em_ordem()
    {
        // Inseridos fora de ordem de propósito: quem ordena tem de ser a consulta.
        var serie = await SemearAsync(("T2E1", 2, 1), ("T1E2", 1, 2), ("T1E1", 1, 1));

        var item = await UmaSerieAsync();

        Assert.Equal(3, item.EpisodesTotal);
        Assert.Equal(0, item.EpisodesWatched);
        Assert.Equal(0d, item.CompletionRatio);
        Assert.Equal("T1E1", item.NextUp!.Name);
        Assert.Equal(serie, item.Id);
    }

    [Fact]
    public async Task Tudo_visto_completa_e_sem_proximo()
    {
        await SemearAsync(("T1E1", 1, 1), ("T1E2", 1, 2));
        await MarcarAsync(_eu, "T1E1", "T1E2");

        var item = await UmaSerieAsync();

        Assert.Equal(2, item.EpisodesWatched);
        Assert.Equal(1d, item.CompletionRatio);
        Assert.Null(item.NextUp);
    }

    [Fact]
    public async Task Proximo_pula_os_vistos_e_respeita_a_ordem_entre_temporadas()
    {
        await SemearAsync(("T1E1", 1, 1), ("T1E2", 1, 2), ("T2E1", 2, 1), ("T2E2", 2, 2));
        await MarcarAsync(_eu, "T1E1", "T1E2", "T2E1");

        var item = await UmaSerieAsync();

        Assert.Equal(4, item.EpisodesTotal);
        Assert.Equal(3, item.EpisodesWatched);
        Assert.Equal(0.75d, item.CompletionRatio);
        Assert.Equal("T2E2", item.NextUp!.Name);
    }

    [Fact]
    public async Task Buraco_no_meio_o_proximo_e_o_episodio_pulado()
    {
        await SemearAsync(("T1E1", 1, 1), ("T1E2", 1, 2), ("T1E3", 1, 3), ("T1E4", 1, 4));
        await MarcarAsync(_eu, "T1E1", "T1E3");

        var item = await UmaSerieAsync();

        // O E2, e não o E4: "onde parei" é o primeiro buraco, não o fim da fila.
        Assert.Equal("T1E2", item.NextUp!.Name);
        Assert.Equal(1, item.NextUp.SeasonNumber);
        Assert.Equal(2, item.NextUp.EpisodeNumber);
    }

    [Fact]
    public async Task Especiais_nao_entram_no_progresso()
    {
        await SemearAsync(("T1E1", 1, 1), ("Especial", 0, 1));

        var item = await UmaSerieAsync();

        // Um episódio regular, não dois: ninguém está devendo os extras.
        Assert.Equal(1, item.EpisodesTotal);
        Assert.Equal("T1E1", item.NextUp!.Name);
    }

    [Fact]
    public async Task Exibicao_de_outro_usuario_nao_conta_como_minha()
    {
        // A MESMA série, acompanhada pelos dois: o catálogo é compartilhado, o histórico não.
        var serie = await SemearAsync(("T1E1", 1, 1), ("T1E2", 1, 2));
        await AcompanharAsync(_outra, serie);
        await MarcarAsync(_outra, "T1E1", "T1E2");

        var meu = await UmaSerieAsync();

        // O filtro global de tenant precisa alcançar a subconsulta de navegação — é isto que
        // separa "assisti" de "alguém assistiu". Sem ele, a série apareceria completa para mim
        // porque outra pessoa a terminou.
        Assert.Equal(0, meu.EpisodesWatched);
        Assert.Equal("T1E1", meu.NextUp!.Name);
        Assert.Null(meu.LastWatchedAt);

        await using var outroDb = _pg.CreateContext(_outra);
        var dela = (await new SeriesQueries(outroDb).GetListAsync()).Single();
        Assert.Equal(2, dela.EpisodesWatched);
        Assert.Null(dela.NextUp);
        Assert.NotNull(dela.LastWatchedAt);
    }

    [Fact]
    public async Task Serie_sem_nenhuma_exibicao_vai_para_o_fim_da_lista()
    {
        var vista = await SemearAsync(("A-T1E1", 1, 1));
        await SemearAsync("Zzz nunca vista", ("Z-T1E1", 1, 1));
        await MarcarAsync(_eu, "A-T1E1");

        await using var db = _pg.CreateContext(_eu);
        var lista = await new SeriesQueries(db).GetListAsync();

        // Em `ORDER BY ... DESC` o Postgres assume NULLS FIRST: sem tratamento explícito, a lista
        // abriria pelas séries que nunca foram tocadas.
        Assert.Equal(vista, lista[0].Id);
        Assert.Null(lista[1].LastWatchedAt);
    }

    [Fact]
    public async Task Next_up_traz_so_as_acompanhadas_e_omite_as_que_estao_em_dia()
    {
        await SemearAsync("Acompanhada com pendência", ("P-T1E1", 1, 1));
        var emDia = await SemearAsync("Acompanhada em dia", ("D-T1E1", 1, 1));
        await SemearAsync("Arquivada", SeriesStatus.Archived, ("X-T1E1", 1, 1));
        await MarcarAsync(_eu, "D-T1E1");

        await using var db = _pg.CreateContext(_eu);
        var fila = await new SeriesQueries(db).GetNextUpAsync();

        var nomes = fila.Select(f => f.SeriesName).ToList();
        Assert.Equal(["Acompanhada com pendência"], nomes);
        Assert.DoesNotContain(fila, f => f.SeriesId == emDia);
    }

    [Fact]
    public async Task Episodio_que_ainda_nao_estreou_nao_e_o_proximo_a_assistir()
    {
        await SemearAsync(("T1E1", 1, 1), ("T1E2", 1, 2));
        await MarcarAsync(_eu, "T1E1");
        await AgendarAsync("T1E2", DateOnly.FromDateTime(DateTime.UtcNow).AddDays(7));

        var item = await UmaSerieAsync();

        // A fila é do que dá para assistir. Apontar para um episódio da semana que vem é oferecer
        // uma pendência que ninguém pode resolver — e era daí que saía o botão de marcar o futuro.
        Assert.Null(item.NextUp);
        Assert.Equal(2, item.EpisodesTotal);
        Assert.Equal(1, item.EpisodesAired);
        Assert.Equal(1, item.EpisodesWatched);

        await using var db = _pg.CreateContext(_eu);
        Assert.Empty(await new SeriesQueries(db).GetNextUpAsync());
    }

    [Fact]
    public async Task Episodio_sem_data_de_exibicao_continua_marcavel()
    {
        // 391 episódios do acervo real não têm `air_date`. Tratá-los como não exibidos impediria
        // alguém de registrar o que de fato assistiu — o erro caro nesta regra.
        await SemearAsync(("T1E1", 1, 1), ("T1E2", 1, 2));

        var item = await UmaSerieAsync();

        Assert.Equal(2, item.EpisodesAired);
        Assert.Equal("T1E1", item.NextUp!.Name);
    }

    // ---- semeadura -------------------------------------------------------------------------

    /// <summary>Dá data de estreia a um episódio já semeado (o semeador cria todos sem data).</summary>
    private async Task AgendarAsync(string episodio, DateOnly quando)
    {
        await using var db = _pg.CreateContext(_eu);
        var ep = await db.Episodes.IgnoreQueryFilters().SingleAsync(e => e.Name == episodio);
        ep.AirDate = quando;
        await db.SaveChangesAsync();
    }


    private Task<long> SemearAsync(params (string Nome, int Temporada, int Episodio)[] eps) =>
        SemearAsync("Série de teste", SeriesStatus.Following, eps);

    private Task<long> SemearAsync(string nome, params (string Nome, int Temporada, int Episodio)[] eps) =>
        SemearAsync(nome, SeriesStatus.Following, eps);

    private async Task<long> SemearAsync(
        string nome, SeriesStatus status, params (string Nome, int Temporada, int Episodio)[] eps)
    {
        await using var db = _pg.CreateContext(_eu);

        var serie = new Series { Name = nome };
        db.Series.Add(serie);
        await db.SaveChangesAsync();

        foreach (var numero in eps.Select(e => e.Temporada).Distinct())
        {
            db.Seasons.Add(new Season { SeriesId = serie.Id, SeasonNumber = numero });
        }
        await db.SaveChangesAsync();

        var temporadas = await db.Seasons
            .Where(s => s.SeriesId == serie.Id)
            .ToDictionaryAsync(s => s.SeasonNumber, s => s.Id);

        foreach (var (epNome, temporada, episodio) in eps)
        {
            db.Episodes.Add(new Episode
            {
                SeriesId = serie.Id,
                SeasonId = temporadas[temporada],
                SeasonNumber = temporada,
                EpisodeNumber = episodio,
                Name = epNome,
                IsSpecial = temporada == 0,
            });
        }

        db.TrackedSeries.Add(new TrackedSeries
        {
            UserId = _eu,
            SeriesId = serie.Id,
            Status = status,
            AddedAt = DateTimeOffset.UtcNow,
        });

        await db.SaveChangesAsync();
        return serie.Id;
    }

    /// <summary>Faz outro usuário acompanhar uma série já existente no catálogo compartilhado.</summary>
    private async Task AcompanharAsync(Guid usuario, long serieId)
    {
        await using var db = _pg.CreateContext(usuario);
        db.TrackedSeries.Add(new TrackedSeries
        {
            UserId = usuario,
            SeriesId = serieId,
            Status = SeriesStatus.Following,
            AddedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
    }

    private async Task MarcarAsync(Guid usuario, params string[] episodios)
    {
        await using var db = _pg.CreateContext(usuario);

        // `IgnoreQueryFilters` porque semear para OUTRO usuário é justamente o caso em que o
        // filtro atrapalha — e é o que o teste de isolamento precisa montar.
        var ids = await db.Episodes
            .IgnoreQueryFilters()
            .Where(e => episodios.Contains(e.Name))
            .Select(e => e.Id)
            .ToListAsync();

        Assert.Equal(episodios.Length, ids.Count);

        foreach (var id in ids)
        {
            db.WatchEvents.Add(WatchEvent.CreateManual(usuario, id, DateTimeOffset.UtcNow));
        }

        await db.SaveChangesAsync();
    }

    private async Task<SeriesListItemDto> UmaSerieAsync()
    {
        await using var db = _pg.CreateContext(_eu);
        return (await new SeriesQueries(db).GetListAsync()).Single();
    }
}
