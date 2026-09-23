namespace Reprise.Application.Enrichment;

/// <summary>Episódio já existente no catálogo local (o que o importador criou a partir do export).</summary>
public readonly record struct ExistingEpisode(
    long Id, int SeasonNumber, int EpisodeNumber, int? RuntimeSeconds, bool RuntimeEstimated);

/// <summary>Episódio a criar — normalmente um que o usuário ainda não assistiu, logo ausente do export.</summary>
public sealed record EpisodeToCreate(
    int SeasonNumber, int EpisodeNumber, int? TmdbId, string? Name,
    DateOnly? AirDate, int? RuntimeSeconds, bool RuntimeEstimated, bool IsSpecial,
    string? StillPath = null, string? Overview = null);

/// <summary>Atualização de um episódio existente. Só campos de metadado — a identidade (Id) é preservada.</summary>
public sealed record EpisodeUpdate(
    long EpisodeId, int? TmdbId, string? Name, DateOnly? AirDate, int? RuntimeSeconds, bool RuntimeEstimated,
    string? StillPath = null, string? Overview = null);

/// <summary>
/// Reposicionamento de um episódio existente para as coordenadas do TMDB. Usado quando os dois
/// catálogos numeram temporadas de formas incompatíveis e o alinhamento passa a ser por <b>ordem</b>.
/// O <see cref="EpisodeId"/> não muda — os <c>watch_events</c> continuam pendurados na mesma linha.
/// </summary>
public sealed record EpisodeRenumber(
    long EpisodeId, int NewSeasonNumber, int NewEpisodeNumber,
    int? TmdbId, string? Name, DateOnly? AirDate, int? RuntimeSeconds, bool RuntimeEstimated,
    string? StillPath = null, string? Overview = null);

/// <summary>
/// O que o enriquecimento fará com uma série. Repare que <b>não existe lista de remoção</b>: é uma
/// decisão deliberada, não um esquecimento. Apagar um episódio derrubaria em cascata os
/// <c>watch_events</c> pendurados nele — ou seja, destruiria o log que é a fonte da verdade do app.
/// </summary>
public sealed record CatalogMergePlan(
    IReadOnlyList<int> SeasonsToCreate,
    IReadOnlyList<EpisodeToCreate> EpisodesToCreate,
    IReadOnlyList<EpisodeUpdate> EpisodeUpdates,
    IReadOnlyList<EpisodeRenumber> EpisodeRenumbers,
    int EpisodesNotFoundInTmdb,
    int RuntimesFilled,
    int? EffectiveAverageRuntimeSeconds,
    bool AlignedByOrder);

/// <summary>Episódio vindo do TMDB, já normalizado (runtime em segundos) para o merge puro.</summary>
public readonly record struct TmdbEpisodeInput(
    int? TmdbId, int SeasonNumber, int EpisodeNumber, string? Name, DateOnly? AirDate, int? RuntimeSeconds,
    string? StillPath = null, string? Overview = null);

/// <summary>
/// Núcleo puro e determinístico do enriquecimento: dado o catálogo local e o que o TMDB devolveu,
/// decide o que criar, atualizar e — quando as numerações não batem — reposicionar. Sem I/O e sem EF,
/// espelhando o par <c>ImportPlanner</c>/<c>ImportService</c>: é aqui que os testes mordem.
/// </summary>
public static class CatalogMerger
{
    /// <summary>
    /// Acima desta fração de episódios locais sem par no TMDB, os dois catálogos estão numerando
    /// temporadas de formas incompatíveis e o casamento por <c>(temporada, episódio)</c> deixa de valer.
    /// 20% separa com folga os dois regimes observados nos dados reais: episódio duplo que o TMDB
    /// funde em um (Friends 3%, The Office 5%) contra anime que o TVDB reparte em muito mais
    /// temporadas (Naruto Shippuden 94%, Yu-Gi-Oh! 78%).
    /// </summary>
    public const double NumberingDivergenceThreshold = 0.20;

    /// <summary>
    /// Abaixo disto a razão não significa nada: com 1 episódio local, um único descasamento já daria
    /// 100%. A menor série realmente divergente dos dados reais tem 23 episódios, então 5 é folgado.
    /// </summary>
    public const int MinimumLocalEpisodesForDivergence = 5;

    public static CatalogMergePlan Plan(
        IEnumerable<ExistingEpisode> existingEpisodes,
        IEnumerable<int> existingSeasonNumbers,
        IEnumerable<TmdbEpisodeInput> tmdbEpisodes,
        int? seriesAverageRuntimeSeconds)
    {
        var local = existingEpisodes.ToList();
        var localByKey = local.ToDictionary(e => (e.SeasonNumber, e.EpisodeNumber));
        var seasons = existingSeasonNumbers.ToHashSet();
        var remote = tmdbEpisodes.ToList();

        // O TMDB frequentemente não declara episode_run_time (o HIMYM, por exemplo, vem sem).
        // Antes de desistir do runtime, cai na mediana do que se sabe: primeiro o que o TMDB deu
        // episódio a episódio, depois o que veio do próprio export — que é dado real do usuário.
        var average = seriesAverageRuntimeSeconds
                      ?? Median(remote.Select(r => r.RuntimeSeconds))
                      ?? Median(local.Select(e => e.RuntimeSeconds));

        var matchedByNumber = remote
            .Select(r => (r.SeasonNumber, r.EpisodeNumber))
            .Where(localByKey.ContainsKey)
            .ToHashSet();

        var notFound = local.Count - matchedByNumber.Count;
        var diverged = local.Count >= MinimumLocalEpisodesForDivergence
                       && (double)notFound / local.Count > NumberingDivergenceThreshold;

        return diverged
            ? PlanByOrder(local, localByKey, seasons, remote, average)
            : PlanByNumbering(localByKey, seasons, remote, average, notFound);
    }

    /// <summary>Caminho normal: os dois catálogos concordam na numeração, então casa por (temporada, episódio).</summary>
    private static CatalogMergePlan PlanByNumbering(
        Dictionary<(int, int), ExistingEpisode> local, HashSet<int> seasons,
        List<TmdbEpisodeInput> remote, int? average, int notFound)
    {
        var seasonsToCreate = new List<int>();
        var toCreate = new List<EpisodeToCreate>();
        var updates = new List<EpisodeUpdate>();
        var runtimesFilled = 0;

        foreach (var r in remote)
        {
            if (seasons.Add(r.SeasonNumber)) seasonsToCreate.Add(r.SeasonNumber);

            if (local.TryGetValue((r.SeasonNumber, r.EpisodeNumber), out var existing))
            {
                var (runtime, estimated, filled) = KeepOrFillRuntime(existing, r.RuntimeSeconds, average);
                runtimesFilled += filled;
                updates.Add(new EpisodeUpdate(existing.Id, r.TmdbId, r.Name, r.AirDate, runtime, estimated, r.StillPath, r.Overview));
            }
            else
            {
                // Episódio que o usuário nunca assistiu: é isto que destrava o "próximo a assistir".
                var (runtime, isEstimate) = ResolveRuntime(r.RuntimeSeconds, average);
                toCreate.Add(new EpisodeToCreate(
                    r.SeasonNumber, r.EpisodeNumber, r.TmdbId, r.Name, r.AirDate,
                    runtime, isEstimate, IsSpecial: r.SeasonNumber == 0, StillPath: r.StillPath, Overview: r.Overview));
            }
        }

        return new CatalogMergePlan(
            seasonsToCreate, toCreate, updates, [], notFound, runtimesFilled, average, AlignedByOrder: false);
    }

    /// <summary>
    /// Caminho da numeração incompatível (anime que o TVDB reparte em muito mais temporadas):
    /// alinha pela <b>ordem de exibição</b>, não pelo par (temporada, episódio). O 1º episódio local
    /// vira o 1º do TMDB, o 2º vira o 2º, e assim por diante.
    ///
    /// A posição absoluta sai do <i>número</i> do episódio, não da contagem de linhas locais — o export
    /// só contém o que foi assistido, então contar linhas comprimiria os buracos. Quem viu do 1 ao 50
    /// e depois do 71 ao 90 tem os 20 pulados preservados como pulo.
    ///
    /// Especiais (temporada 0) ficam de fora da ordem: não pertencem à sequência linear e a numeração
    /// de especiais raramente corresponde entre os dois catálogos.
    /// </summary>
    private static CatalogMergePlan PlanByOrder(
        List<ExistingEpisode> local, Dictionary<(int, int), ExistingEpisode> localByKey,
        HashSet<int> seasons, List<TmdbEpisodeInput> remote, int? average)
    {
        var localRegular = local.Where(e => e.SeasonNumber > 0)
            .OrderBy(e => e.SeasonNumber).ThenBy(e => e.EpisodeNumber).ToList();
        var remoteRegular = remote.Where(r => r.SeasonNumber > 0)
            .OrderBy(r => r.SeasonNumber).ThenBy(r => r.EpisodeNumber).ToList();

        // Tamanho de cada temporada local = maior número visto nela. Vale porque, nos dados reais,
        // toda temporada dessas séries é contígua a partir do episódio 1.
        var seasonSize = localRegular
            .GroupBy(e => e.SeasonNumber)
            .ToDictionary(g => g.Key, g => g.Max(e => e.EpisodeNumber));

        var offset = new Dictionary<int, int>();
        var running = 0;
        foreach (var season in seasonSize.Keys.Order())
        {
            offset[season] = running;
            running += seasonSize[season];
        }

        var renumbers = new List<EpisodeRenumber>();
        var claimed = new HashSet<int>();
        var runtimesFilled = 0;
        var unplaced = 0;

        foreach (var e in localRegular)
        {
            var ordinal = offset[e.SeasonNumber] + e.EpisodeNumber; // 1-based
            if (ordinal > remoteRegular.Count)
            {
                unplaced++; // o TMDB tem menos episódios que a ordem local alcança: preserva como está
                continue;
            }

            var target = remoteRegular[ordinal - 1];
            claimed.Add(ordinal);

            var (runtime, estimated, filled) = KeepOrFillRuntime(e, target.RuntimeSeconds, average);
            runtimesFilled += filled;
            renumbers.Add(new EpisodeRenumber(
                e.Id, target.SeasonNumber, target.EpisodeNumber,
                target.TmdbId, target.Name, target.AirDate, runtime, estimated, target.StillPath, target.Overview));
        }

        var seasonsToCreate = new List<int>();
        var toCreate = new List<EpisodeToCreate>();
        var updates = new List<EpisodeUpdate>();

        // Toda temporada do TMDB passa a existir: as posições reposicionadas caem nelas.
        foreach (var r in remote)
            if (seasons.Add(r.SeasonNumber)) seasonsToCreate.Add(r.SeasonNumber);

        // Posições da ordem que ninguém ocupou = episódios ainda não assistidos.
        for (var i = 0; i < remoteRegular.Count; i++)
        {
            if (claimed.Contains(i + 1)) continue;
            var r = remoteRegular[i];
            var (runtime, isEstimate) = ResolveRuntime(r.RuntimeSeconds, average);
            toCreate.Add(new EpisodeToCreate(
                r.SeasonNumber, r.EpisodeNumber, r.TmdbId, r.Name, r.AirDate,
                runtime, isEstimate, IsSpecial: false, StillPath: r.StillPath, Overview: r.Overview));
        }

        // Especiais continuam casando por número — fora da ordem linear.
        foreach (var r in remote.Where(x => x.SeasonNumber == 0))
        {
            if (localByKey.TryGetValue((0, r.EpisodeNumber), out var existing))
            {
                var (runtime, estimated, filled) = KeepOrFillRuntime(existing, r.RuntimeSeconds, average);
                runtimesFilled += filled;
                updates.Add(new EpisodeUpdate(existing.Id, r.TmdbId, r.Name, r.AirDate, runtime, estimated, r.StillPath, r.Overview));
            }
            else
            {
                var (runtime, isEstimate) = ResolveRuntime(r.RuntimeSeconds, average);
                toCreate.Add(new EpisodeToCreate(
                    0, r.EpisodeNumber, r.TmdbId, r.Name, r.AirDate, runtime, isEstimate,
                    IsSpecial: true, StillPath: r.StillPath, Overview: r.Overview));
            }
        }

        var localSpecials = local.Count(e => e.SeasonNumber == 0);
        var matchedSpecials = updates.Count;

        return new CatalogMergePlan(
            seasonsToCreate, toCreate, updates, renumbers,
            EpisodesNotFoundInTmdb: unplaced + (localSpecials - matchedSpecials),
            runtimesFilled, average, AlignedByOrder: true);
    }

    /// <summary>
    /// Runtime que veio do export é dado do usuário e prevalece: foi com ele que as estatísticas dele
    /// sempre foram contadas. O TMDB só preenche o que está vazio.
    /// </summary>
    private static (int? Runtime, bool Estimated, int Filled) KeepOrFillRuntime(
        ExistingEpisode existing, int? remoteRuntime, int? average)
    {
        if (existing.RuntimeSeconds is not null)
            return (existing.RuntimeSeconds, existing.RuntimeEstimated, 0);

        var (filled, isEstimate) = ResolveRuntime(remoteRuntime, average);
        return filled is null ? (null, false, 0) : (filled, isEstimate, 1);
    }

    /// <summary>Mediana, não média: um piloto duplo ou um final estendido não deve puxar o valor típico.</summary>
    private static int? Median(IEnumerable<int?> values)
    {
        var v = values.Where(x => x is > 0).Select(x => x!.Value).OrderBy(x => x).ToList();
        return v.Count == 0 ? null : v[v.Count / 2];
    }

    /// <summary>
    /// Runtime real do episódio quando o TMDB tem; senão, a média da série. Só o segundo caso é
    /// <i>estimativa</i> — daí o flag, que existe para as estatísticas saberem o que é medido e o que é chute.
    /// </summary>
    private static (int? Runtime, bool Estimated) ResolveRuntime(int? episodeRuntime, int? seriesAverage) =>
        episodeRuntime is > 0 ? (episodeRuntime, false)
        : seriesAverage is > 0 ? (seriesAverage, true)
        : (null, false);
}
