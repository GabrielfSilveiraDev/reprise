namespace Reprise.Domain.Scheduling;

/// <summary>
/// Quando um episódio fica disponível, como <b>instante absoluto</b>.
///
/// <para>
/// <b>O problema.</b> O TMDB guarda <c>air_date</c> como data pura, sem hora e sem fuso — conferido
/// na API: nem o episódio nem a série trazem horário em campo nenhum. Tratar essa data como se
/// fosse do fuso de quem olha produz o erro que originou esta classe: Silo T3E10 e Dark Matter
/// T2E2 têm <c>air_date</c> 03/09 (quinta) no calendário americano, e o app dizia "Estreou hoje"
/// à 00h01 de quinta no Brasil — quando na verdade os dois só chegam aqui na madrugada de sexta.
/// O próprio TMDB discordava: o <c>next_episode_to_air</c> dele ainda apontava esses episódios.
/// </para>
///
/// <para>
/// <b>Duas fontes, não uma.</b> O TVmaze publica a data como ela se observa e, em TV linear, o
/// horário de verdade. Comparados episódio a episódio contra o acervo real (402 episódios, 32
/// séries), os dois concordam em 77% e divergem em um dia nos 22% restantes — 69 de 69 episódios
/// de Apple TV, parte dos de Prime Video, e nada em Netflix, HBO, Disney+, FX, The CW, Adult Swim
/// ou Crunchyroll. Por isso o TVmaze manda quando existe, e o TMDB é o que sobra.
/// Ver <see cref="ReleasesAt(EpisodeRelease)"/> para os três casos.
/// </para>
///
/// <para>
/// <b>Por que o instante, e não a data.</b> Devolvendo o momento absoluto, o cliente só precisa
/// comparar com o relógio dele — e o rótulo sai certo de graça, porque converter esse instante
/// para o fuso do usuário já dá o dia certo <i>na experiência dele</i>. Silo estreando na
/// madrugada de sexta faz o app dizer "Estreia amanhã" na quinta à tarde, que é o que a pessoa vê
/// acontecer. A alternativa — mandar país e data e repetir a tabela de fusos nos dois clientes —
/// duplicaria a regra em três lugares para chegar ao mesmo número.
/// </para>
///
/// <para>
/// <b>Uma regra só, para a tela e para o botão.</b> Já foram duas: a marcação usava
/// <c>Episode.HasAired</c>, permissiva, enquanto a tela usava esta. A separação tinha lógica — um
/// botão liberado cedo custa um clique desfeito, e travado tarde impede registrar o que se acabou
/// de assistir — mas produzia a incoerência de oferecer "marcar como visto" logo abaixo de um
/// texto dizendo "Estreia amanhã". Com o TVmaze o instante ficou preciso o bastante para as duas
/// perguntas terem a mesma resposta, e é isso que as duas passaram a usar.
/// </para>
/// </summary>
public static class ReleaseSchedule
{
    /// <summary>
    /// Deslocamento do fuso de origem, em minutos, por país (ISO 3166-1 alfa-2).
    ///
    /// <para>
    /// Guarda o <b>horário padrão</b> (de inverno) e, em país com vários fusos, o <b>mais a
    /// oeste</b> — os dois na direção conservadora: o horário de verão adianta o fim do dia, e um
    /// fuso mais a leste também, então errar para o lado do fuso mais atrasado nunca antecipa a
    /// estreia. Estados Unidos entra como Pacífico e não como Havaí porque produção fica no
    /// continente; Austrália entra como Perth; Rússia, como Moscou.
    /// </para>
    ///
    /// <para>
    /// A tabela cobre os países do acervo real (51 séries americanas, 5 japonesas, 3 britânicas,
    /// 2 australianas, 1 espanhola, 1 canadense) mais os vizinhos óbvios. País ausente cai no
    /// padrão — ver <see cref="DefaultOffsetMinutes"/>.
    /// </para>
    /// </summary>
    private static readonly Dictionary<string, int> OffsetMinutesByCountry = new(StringComparer.OrdinalIgnoreCase)
    {
        ["US"] = -480, ["CA"] = -480, ["MX"] = -480,
        ["BR"] = -180, ["AR"] = -180, ["CL"] = -180,
        ["GB"] = 0, ["IE"] = 0, ["PT"] = 0, ["IS"] = 0,
        ["ES"] = 60, ["FR"] = 60, ["DE"] = 60, ["IT"] = 60, ["NL"] = 60, ["BE"] = 60,
        ["SE"] = 60, ["DK"] = 60, ["NO"] = 60, ["PL"] = 60, ["CZ"] = 60, ["AT"] = 60, ["CH"] = 60,
        ["FI"] = 120, ["GR"] = 120, ["IL"] = 120, ["ZA"] = 120, ["UA"] = 120,
        ["TR"] = 180, ["RU"] = 180,
        ["IN"] = 330,
        ["CN"] = 480, ["TW"] = 480, ["HK"] = 480, ["SG"] = 480, ["AU"] = 480,
        ["JP"] = 540, ["KR"] = 540,
        ["NZ"] = 720
    };

    /// <summary>
    /// Padrão para série sem país conhecido: Pacífico americano.
    ///
    /// Não é neutralidade, é a aposta certa para este acervo — a maioria esmagadora do catálogo é
    /// americana, e é também o fuso mais atrasado da tabela entre os países comuns, o que mantém o
    /// viés conservador para qualquer série ainda não enriquecida.
    /// </summary>
    public const int DefaultOffsetMinutes = -480;

    public static int OffsetMinutes(string? originCountry) =>
        originCountry is not null && OffsetMinutesByCountry.TryGetValue(originCountry, out var m)
            ? m
            : DefaultOffsetMinutes;

    /// <summary>
    /// O instante em que o episódio passa a contar como lançado. Nulo quando não há data nenhuma —
    /// e aí não há o que prometer.
    ///
    /// <para>
    /// <b>Três casos, do mais preciso ao mais grosseiro:</b>
    /// </para>
    ///
    /// <para>
    /// <b>1. O TVmaze declarou horário</b> (TV linear). O instante é dele, e é exato. Nada a
    /// heurizar.
    /// </para>
    ///
    /// <para>
    /// <b>2. Só a data do TVmaze</b> (streaming). Usa o <b>início</b> desse dia no fuso de origem.
    /// Parece arbitrário e não é: a data do TVmaze já é a do lançamento como se observa, então não
    /// há deslocamento a compensar. Medido contra os dois serviços que dominam o acervo, cai bem —
    /// para a Netflix, que solta à meia-noite do Pacífico, bate no minuto; para a Apple TV+, que
    /// solta à meia-noite do Leste, fica três horas atrasado. Erra tarde, nunca cedo.
    /// </para>
    ///
    /// <para>
    /// <b>3. Só a data do TMDB.</b> Usa o <b>fim</b> do dia, e não o início, porque essa data é a
    /// do calendário de origem e sabidamente vem um dia antes em parte do catálogo — 22% dos
    /// episódios medidos, e 100% dos de Apple TV. Sem saber de qual metade o episódio é, o fim do
    /// dia é o limite que não anuncia estreia que ainda não aconteceu. É a única das três que é
    /// palpite, e é a que some à medida que o TVmaze cobre o acervo.
    /// </para>
    /// </summary>
    public static DateTimeOffset? ReleasesAt(EpisodeRelease e)
    {
        if (e.TvmazeAirStamp is { } exato) return exato;

        var offset = TimeSpan.FromMinutes(OffsetMinutes(e.OriginCountry));

        if (e.TvmazeAirDate is { } doTvmaze)
            return new DateTimeOffset(doTvmaze.ToDateTime(TimeOnly.MinValue), offset);

        if (e.AirDate is { } doTmdb)
            return new DateTimeOffset(doTmdb.AddDays(1).ToDateTime(TimeOnly.MinValue), offset);

        return null;
    }

    /// <inheritdoc cref="ReleasesAt(EpisodeRelease)"/>
    public static DateTimeOffset? ReleasesAt(DateOnly? airDate, string? originCountry) =>
        ReleasesAt(EpisodeRelease.FromTmdb(airDate, originCountry));

    /// <summary>
    /// Já lançou? <b>Sem data conta como lançado</b>, pela mesma razão de
    /// <c>Episode.HasAired</c>: são centenas de episódios antigos que o TMDB nunca datou, e
    /// escondê-los como "por vir" seria pior do que mostrá-los.
    /// </summary>
    public static bool HasReleased(EpisodeRelease e, DateTimeOffset now) =>
        ReleasesAt(e) is not { } at || now >= at;

    /// <inheritdoc cref="HasReleased(EpisodeRelease, DateTimeOffset)"/>
    public static bool HasReleased(DateOnly? airDate, string? originCountry, DateTimeOffset now) =>
        HasReleased(EpisodeRelease.FromTmdb(airDate, originCountry), now);
}
