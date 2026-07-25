namespace Reprise.Application.Features.Watching;

/// <summary>Uma exibição, reduzida ao que uma sessão precisa saber.</summary>
public readonly record struct SessionEvent(DateTimeOffset WatchedAt, long EpisodeId, int? RuntimeSeconds);

/// <summary>
/// Uma passada pela série — uma "maratona". Derivada do log, como tudo aqui.
/// </summary>
public sealed record RewatchSession(
    int Ordinal,
    DateTimeOffset StartedAt,
    DateTimeOffset EndedAt,
    int Exhibitions,
    int DistinctEpisodes,
    long TotalSeconds)
{
    /// <summary>Dias entre a primeira e a última exibição. Uma sessão de um dia só conta 1.</summary>
    public int SpanDays => Math.Max(1, (EndedAt.Date - StartedAt.Date).Days + 1);
}

/// <summary>
/// Agrupa exibições de uma série em <b>sessões</b>: cada uma é uma vez que você percorreu (ou
/// começou a percorrer) a série.
///
/// <para>
/// A pergunta que isto responde é a que o nome do app faz: "quantas vezes eu revi isso, e quando?".
/// A contagem por episódio já dizia <i>quanto</i>; ela não diz que as 17 exibições de um episódio
/// foram três maratonas em anos diferentes e não dezessete tardes soltas.
/// </para>
///
/// <para>
/// <b>O corte é por silêncio, não por episódio.</b> Duas exibições separadas por semanas são
/// passadas diferentes mesmo que sigam a ordem dos episódios; duas no mesmo fim de semana são a
/// mesma, mesmo fora de ordem. Ninguém termina uma série e recomeça no dia seguinte sem que isso
/// seja, para todos os efeitos, a mesma sessão — mas dois meses parados são.
/// </para>
///
/// <para>
/// Puro e determinístico: recebe eventos ordenáveis e devolve grupos. É onde os testes mordem.
/// </para>
/// </summary>
public static class RewatchSessionCalculator
{
    /// <summary>
    /// Silêncio que separa duas sessões. 21 dias é mais que qualquer intervalo semanal de série
    /// em exibição (que geraria falsos cortes) e menos que a pausa típica entre temporadas.
    /// </summary>
    public static readonly TimeSpan DefaultGap = TimeSpan.FromDays(21);

    public static IReadOnlyList<RewatchSession> Compute(
        IEnumerable<SessionEvent> events, TimeSpan? gap = null)
    {
        var threshold = gap ?? DefaultGap;
        var ordered = events.OrderBy(e => e.WatchedAt).ToList();
        if (ordered.Count == 0) return Array.Empty<RewatchSession>();

        var sessions = new List<RewatchSession>();
        var current = new List<SessionEvent> { ordered[0] };

        foreach (var e in ordered.Skip(1))
        {
            if (e.WatchedAt - current[^1].WatchedAt > threshold)
            {
                sessions.Add(Build(sessions.Count + 1, current));
                current = [e];
            }
            else
            {
                current.Add(e);
            }
        }

        sessions.Add(Build(sessions.Count + 1, current));
        return sessions;
    }

    private static RewatchSession Build(int ordinal, List<SessionEvent> events) => new(
        ordinal,
        events[0].WatchedAt,
        events[^1].WatchedAt,
        events.Count,
        events.Select(e => e.EpisodeId).Distinct().Count(),
        events.Sum(e => (long)(e.RuntimeSeconds ?? 0)));
}
