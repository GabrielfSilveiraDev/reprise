namespace Reprise.Domain.Scheduling;

/// <summary>
/// Tudo o que se sabe sobre <b>quando</b> um episódio fica disponível, vindo das duas fontes.
///
/// <para>
/// Existe para <see cref="ReleaseSchedule"/> não virar uma função de quatro argumentos soltos
/// chamada em oito lugares — e para que acrescentar uma fonte no futuro seja um campo aqui, e não
/// mais um parâmetro em cada chamada.
/// </para>
/// </summary>
/// <param name="AirDate">
/// A data do TMDB. Sem hora e sem fuso, e no <b>calendário do país de origem</b> — para a
/// Apple TV+ ela vem um dia antes do que se vê no Brasil.
/// </param>
/// <param name="TvmazeAirDate">
/// A data do TVmaze. Medida contra o acervo real, ela concorda com o TMDB em 77% dos episódios e
/// é um dia depois nos outros 22% — 69 de 69 episódios de Apple TV, parte dos de Prime Video.
/// É a data que corresponde ao que se observa.
/// </param>
/// <param name="TvmazeAirStamp">
/// O instante exato, do TVmaze, <b>só quando ele declara horário de exibição</b>. Vale para TV
/// linear (26 das 64 séries acompanhadas). Em streaming o TVmaze preenche o campo com meio-dia
/// UTC de enchimento — por isso a sincronização só grava aqui quando há <c>airtime</c> de verdade,
/// e nunca o placeholder: tratá-lo como hora real faria o app anunciar uma estreia às 9h da manhã.
/// </param>
/// <param name="OriginCountry">País de origem, que dá o fuso quando só há data.</param>
public readonly record struct EpisodeRelease(
    DateOnly? AirDate,
    DateOnly? TvmazeAirDate,
    DateTimeOffset? TvmazeAirStamp,
    string? OriginCountry)
{
    /// <summary>Atalho para quem só tem o TMDB — testes e código anterior ao TVmaze.</summary>
    public static EpisodeRelease FromTmdb(DateOnly? airDate, string? originCountry) =>
        new(airDate, null, null, originCountry);
}
