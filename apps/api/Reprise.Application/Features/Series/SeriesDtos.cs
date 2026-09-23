namespace Reprise.Application.Features.Series;

public sealed record EpisodeRefDto(long Id, int SeasonNumber, int EpisodeNumber, string? Name);

public sealed record SeriesListItemDto(
    long Id,
    int? TvdbId,
    string Name,
    string? PosterPath,
    string Status,
    /// <summary>
    /// Situação da PRODUÇÃO, vinda do TMDB ("Ended", "Canceled", "Returning Series"…), que é coisa
    /// diferente de <paramref name="Status"/> — este é a relação do usuário com a série. É a
    /// combinação dos dois que responde "já acabou e eu terminei?".
    /// </summary>
    string? ProductionStatus,
    int EpisodesTotal,
    /// <summary>
    /// Destes, quantos já foram ao ar — o denominador de "estou em dia?".
    ///
    /// <para>
    /// Sem ele a Silo aparecia atrasada por seis episódios que só estreiam entre agosto e setembro,
    /// e não havia como o cliente distinguir "falta assistir" de "falta lançar" usando só o total.
    /// O total continua sendo o denominador da barra, porque encolher a régua quando a temporada
    /// vai ao ar faria o progresso andar para trás sem ninguém ter feito nada.
    /// </para>
    /// </summary>
    int EpisodesAired,
    int EpisodesWatched,
    double CompletionRatio,
    DateTimeOffset? LastWatchedAt,
    EpisodeRefDto? NextUp);

public sealed record EpisodeDto(
    long Id,
    int SeasonNumber,
    int EpisodeNumber,
    string? Name,
    int? RuntimeSeconds,
    bool IsSpecial,
    int WatchCount,
    DateTimeOffset? LastWatchedAt,
    /// <summary>Imagem de cena no TMDB. Nulo é comum em especiais (só 66% deles têm).</summary>
    string? StillPath,
    /// <summary>
    /// Sinopse do episódio. Vai em toda listagem porque o painel de detalhes abre sem ida ao
    /// servidor — uma temporada inteira cabe numa resposta que o cliente já buscava, e um
    /// endpoint por episódio trocaria isso por um giro de rede a cada clique.
    /// </summary>
    string? Overview,
    DateOnly? AirDate,
    /// <summary>
    /// Instante em que o episódio passa a contar como lançado — ver <c>ReleaseSchedule</c>.
    ///
    /// Vem calculado do servidor porque a conta depende do país de origem da série, e repetir a
    /// tabela de fusos no web e no app daria três lugares para a mesma regra divergir. O cliente
    /// só compara com o relógio dele, e é dessa comparação que sai o "estreia amanhã" no fuso de
    /// quem está olhando. Nulo quando não há <c>AirDate</c>.
    /// </summary>
    DateTimeOffset? ReleasesAt);

public sealed record SeasonDto(
    int SeasonNumber,
    string? Name,
    bool IsSpecials,
    IReadOnlyList<EpisodeDto> Episodes);

public sealed record SeriesDetailDto(
    long Id,
    int? TvdbId,
    string Name,
    string? OriginalName,
    string? Overview,
    string? PosterPath,
    string Status,
    /// <summary>Situação da produção no TMDB — ver <see cref="SeriesListItemDto.ProductionStatus"/>.</summary>
    string? ProductionStatus,
    DateOnly? FirstAirDate,
    int EpisodesTotal,
    /// <summary>Quantos já foram ao ar — ver <see cref="SeriesListItemDto.EpisodesAired"/>.</summary>
    int EpisodesAired,
    int EpisodesWatched,
    double CompletionRatio,
    IReadOnlyList<SeasonDto> Seasons,
    /// <summary>
    /// Cada vez que você percorreu esta série, derivada do log por silêncio entre exibições.
    /// A contagem por episódio diz QUANTO; isto diz QUANDO — que é a pergunta do nome do app.
    ///
    /// <para>
    /// <b>Sem as marcações em massa.</b> Uma sessão é uma afirmação sobre <i>quando</i>, e o
    /// backfill do TV Time não tem quando: todas as exibições importadas carregam a data da
    /// importação. Incluí-las produziria uma sessão gigante e falsa — HIMYM apareceria como
    /// 2.851 exibições em 24 dias. Fora delas, o que sobra é curto mas verdadeiro.
    /// </para>
    /// </summary>
    IReadOnlyList<RewatchSessionDto> Sessions,
    /// <summary>Quantas exibições ficaram de fora das sessões por serem marcação em massa.</summary>
    int BackfillExhibitions);

public sealed record RewatchSessionDto(
    int Ordinal,
    DateTimeOffset StartedAt,
    DateTimeOffset EndedAt,
    int Exhibitions,
    int DistinctEpisodes,
    long TotalSeconds,
    int SpanDays);

public sealed record NextUpItemDto(
    long SeriesId,
    string SeriesName,
    string? PosterPath,
    EpisodeRefDto Episode,
    DateTimeOffset? LastActivityAt,
    /// <summary>
    /// A série está sendo revista: <see cref="Episode"/> é o seguinte ao último episódio
    /// REPETIDO, e não o primeiro nunca visto. Vale para qualquer estado de acompanhamento —
    /// quem remarca uma série concluída está assistindo, diga o status o que disser.
    /// </summary>
    bool IsRewatch);

/// <summary>Estado de um episódio após uma marcação/desmarcação (o log é a fonte da verdade).</summary>
public sealed record WatchStateDto(long EpisodeId, int WatchCount, DateTimeOffset? LastWatchedAt);
