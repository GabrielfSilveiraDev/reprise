using Microsoft.EntityFrameworkCore;
using Reprise.Application.Features.Premieres;
using Reprise.Domain.Entities;
using Reprise.Domain.Enums;

namespace Reprise.Tests.Integration;

/// <summary>
/// A lista de estreias, contra um Postgres de verdade.
///
/// <para>
/// Os casos cobrem o que a tela inicial passou a precisar dela: o resumo do episódio, a SUA última
/// exibição na série — que é o que separa "estou assistindo" de "só acompanho" — e o fim do teto
/// de 180 dias, que escondia a volta de Silo em 2027. A regra de quais estreias aparecem mora no
/// cliente (no web, <c>PremiereAgenda</c>) e é testada lá.
/// </para>
/// </summary>
public sealed class PremiereQueriesTests : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private readonly PostgresFixture _pg;
    private readonly Guid _eu = Guid.NewGuid();
    private readonly Guid _outra = Guid.NewGuid();

    /// <summary>Fixo, e não o relógio: o que é "futuro" não pode depender de quando a suíte roda.</summary>
    private static readonly DateTimeOffset Agora = new(2026, 9, 22, 21, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Hoje = DateOnly.FromDateTime(Agora.UtcDateTime);

    public PremiereQueriesTests(PostgresFixture pg) => _pg = pg;

    public async Task InitializeAsync()
    {
        await using var db = _pg.CreateContext(_eu);
        await db.Database.ExecuteSqlRawAsync(
            "TRUNCATE watch_events, tracked_series, episodes, seasons, series RESTART IDENTITY CASCADE");
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Traz_o_resumo_do_episodio_e_a_sua_ultima_exibicao_na_serie()
    {
        var serie = await SemearAsync("Dark Matter",
            ("T2E4", Hoje.AddDays(-5), null),
            ("T2E5", Hoje.AddDays(3), "Amar e ser amado."));
        var visto = Agora.AddDays(-1);
        await MarcarAsync(_eu, "T2E4", visto);

        var estreias = await EstreiasAsync(_eu);

        var e5 = Assert.Single(estreias);
        Assert.Equal(serie, e5.SeriesId);
        Assert.Equal("Amar e ser amado.", e5.Overview);
        Assert.Equal(visto, e5.LastActivityAt);
    }

    [Fact]
    public async Task Sem_horizonte_nao_ha_limite_de_distancia()
    {
        // A volta de Silo: anunciada com quase um ano de antecedência. Com o teto antigo de 180
        // dias ela não chegava ao cliente, e "o próximo episódio da série que estou assistindo"
        // ficava sem resposta.
        await SemearAsync("Silo", ("T4E1", Hoje.AddDays(290), null));

        Assert.Single(await EstreiasAsync(_eu));
        Assert.Empty(await EstreiasAsync(_eu, withinDays: 180));
    }

    [Fact]
    public async Task A_ultima_exibicao_e_a_sua_e_nao_a_de_quem_mais_acompanha_a_serie()
    {
        var serie = await SemearAsync("Série compartilhada",
            ("T1E1", Hoje.AddDays(-10), null),
            ("T1E2", Hoje.AddDays(7), "Resumo."));
        await AcompanharAsync(_outra, serie);
        await MarcarAsync(_outra, "T1E1", Agora.AddDays(-2));

        // Para mim a série nunca foi vista: é outra pessoa que a está assistindo. Sem o filtro de
        // tenant na agregação, a estreia dela apareceria para mim como "série em andamento".
        Assert.Null(Assert.Single(await EstreiasAsync(_eu)).LastActivityAt);
        Assert.NotNull(Assert.Single(await EstreiasAsync(_outra)).LastActivityAt);
    }

    [Fact]
    public async Task Todos_os_episodios_futuros_vem_e_nao_so_o_proximo()
    {
        // Um aviso de estreia é agendado por episódio a partir desta lista. Quem recorta é a tela,
        // no cliente — aqui cortar mataria o aviso da semana seguinte.
        await SemearAsync("Semanal",
            ("T1E1", Hoje.AddDays(2), "Um."),
            ("T1E2", Hoje.AddDays(9), "Dois."),
            ("T1E3", Hoje.AddDays(16), null));

        var estreias = await EstreiasAsync(_eu);

        Assert.Equal([1, 2, 3], estreias.Select(e => e.EpisodeNumber));
    }

    // ---- semeadura -------------------------------------------------------------------------

    private async Task<IReadOnlyList<PremiereDto>> EstreiasAsync(Guid usuario, int? withinDays = null)
    {
        await using var db = _pg.CreateContext(usuario);
        return await new PremiereQueries(db).GetUpcomingAsync(Agora, withinDays);
    }

    /// <summary>Série acompanhada por mim, na temporada tirada do nome ("T2E5" é da 2).</summary>
    private async Task<long> SemearAsync(
        string nome, params (string Nome, DateOnly AirDate, string? Resumo)[] eps)
    {
        await using var db = _pg.CreateContext(_eu);

        var serie = new Series { Name = nome, CreatedAt = Agora, UpdatedAt = Agora };
        db.Series.Add(serie);
        await db.SaveChangesAsync();

        var coordenadas = eps
            .Select(e => (e.Nome, e.AirDate, e.Resumo, Temporada: int.Parse(e.Nome[1..e.Nome.IndexOf('E')]),
                Numero: int.Parse(e.Nome[(e.Nome.IndexOf('E') + 1)..])))
            .ToList();

        var temporadas = new Dictionary<int, Season>();
        foreach (var numero in coordenadas.Select(c => c.Temporada).Distinct())
        {
            temporadas[numero] = new Season { SeriesId = serie.Id, SeasonNumber = numero };
            db.Seasons.Add(temporadas[numero]);
        }
        await db.SaveChangesAsync();

        foreach (var c in coordenadas)
        {
            db.Episodes.Add(new Episode
            {
                SeriesId = serie.Id,
                SeasonId = temporadas[c.Temporada].Id,
                SeasonNumber = c.Temporada,
                EpisodeNumber = c.Numero,
                Name = c.Nome,
                AirDate = c.AirDate,
                Overview = c.Resumo,
            });
        }

        db.TrackedSeries.Add(new TrackedSeries
        {
            UserId = _eu, SeriesId = serie.Id, Status = SeriesStatus.Following, AddedAt = Agora,
        });

        await db.SaveChangesAsync();
        return serie.Id;
    }

    private async Task AcompanharAsync(Guid usuario, long serieId)
    {
        await using var db = _pg.CreateContext(usuario);
        db.TrackedSeries.Add(new TrackedSeries
        {
            UserId = usuario, SeriesId = serieId, Status = SeriesStatus.Following, AddedAt = Agora,
        });
        await db.SaveChangesAsync();
    }

    private async Task MarcarAsync(Guid usuario, string episodio, DateTimeOffset quando)
    {
        await using var db = _pg.CreateContext(usuario);
        var id = await db.Episodes.Where(e => e.Name == episodio).Select(e => e.Id).SingleAsync();
        db.WatchEvents.Add(WatchEvent.CreateManual(usuario, id, quando));
        await db.SaveChangesAsync();
    }
}
