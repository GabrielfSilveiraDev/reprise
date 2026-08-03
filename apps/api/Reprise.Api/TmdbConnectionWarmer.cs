using Reprise.Application.Abstractions;

namespace Reprise.Api;

/// <summary>
/// Mantém aberta a conexão do servidor com o TMDB.
///
/// <para>
/// <b>O problema.</b> Uma busca custa 0,44 s com a conexão fria e 0,17 s com ela aberta — medido
/// contra a API real. A diferença inteira é aperto de mão: DNS, TCP e TLS somam ~300 ms, enquanto a
/// resposta em si são poucos quilobytes. Como o pool do <c>SocketsHttpHandler</c> descarta conexão
/// ociosa em um minuto, num app pessoal — onde se busca uma série, some por três dias e busca outra
/// — TODA busca é a primeira busca, e portanto a cara.
/// </para>
///
/// <para>
/// <b>O que isto faz.</b> Uma requisição a <c>/configuration</c>, a mais barata do TMDB, a cada 45
/// segundos. É menos que o minuto de ociosidade do pool, então a conexão nunca chega a ser
/// descartada e a busca de quem estiver do outro lado já encontra o caminho aberto.
/// </para>
///
/// <para>
/// <b>O custo.</b> Cerca de 1.900 requisições por dia, de resposta pequena, contra um serviço que
/// não impõe limite diário. É desperdício deliberado: 300 ms na frente de cada busca de uma pessoa
/// custam mais, em atenção, do que um ping ocioso custa em rede.
/// </para>
///
/// <para>
/// <b>Só na API.</b> A CLI de importação também usa o TMDB, mas roda e termina — não há pool para
/// manter vivo. Por isso isto se registra no host web, e não junto do cliente em
/// <c>AddRepriseTmdb</c>.
/// </para>
/// </summary>
public sealed class TmdbConnectionWarmer : BackgroundService
{
    /// <summary>Abaixo do minuto de ociosidade do pool — é isso que faz a conexão sobreviver.</summary>
    private static readonly TimeSpan Intervalo = TimeSpan.FromSeconds(45);

    private readonly ITmdbClient _tmdb;
    private readonly ILogger<TmdbConnectionWarmer> _log;

    public TmdbConnectionWarmer(ITmdbClient tmdb, ILogger<TmdbConnectionWarmer> log)
    {
        _tmdb = tmdb;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Intervalo);

        do
        {
            try
            {
                await _tmdb.WarmUpAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Desligando. Não é erro.
                return;
            }
            catch (Exception ex)
            {
                // Falhar aqui não é falhar em nada: a busca seguinte apenas paga o aperto de mão,
                // que é o que acontecia antes disto existir. Registrar em Debug para não encher o
                // log quando a máquina passa a noite sem rede.
                _log.LogDebug(ex, "Não foi possível manter a conexão com o TMDB aquecida.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false));
    }
}
