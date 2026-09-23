using Reprise.Infrastructure.Catalog;

namespace Reprise.Api;

/// <summary>
/// Roda a <see cref="CatalogRefresh"/> enquanto a API estiver de pé.
///
/// <para>
/// <b>Na subida, e depois de hora em hora.</b> Este app não fica ligado o tempo todo: o atalho do
/// Windows sobe a API quando você abre o Reprise e a derruba quando você fecha. Por isso a primeira
/// rodada é logo na partida — é ela que põe em dia o catálogo depois de dias com o app fechado. As
/// seguintes são baratas quando não há nada vencido (uma consulta que volta vazia), e é a validade
/// de 12 horas da própria <see cref="CatalogRefresh"/>, e não este intervalo, que decide quando
/// uma série volta a ser consultada.
/// </para>
///
/// <para>
/// <b>A espera antes da primeira rodada</b> deixa a tela que acabou de abrir fazer as consultas
/// dela sem disputar o banco e a rede com meia centena de séries sendo reprocessadas.
/// </para>
///
/// <para>
/// <b>Só na API</b>, como o <see cref="TmdbConnectionWarmer"/>: a CLI roda e termina.
/// </para>
/// </summary>
public sealed class CatalogRefreshWorker : BackgroundService
{
    private static readonly TimeSpan Espera = TimeSpan.FromSeconds(20);
    private static readonly TimeSpan Intervalo = TimeSpan.FromHours(1);

    private readonly IServiceScopeFactory _escopos;
    private readonly TimeProvider _relogio;
    private readonly ILogger<CatalogRefreshWorker> _log;

    public CatalogRefreshWorker(
        IServiceScopeFactory escopos, TimeProvider relogio, ILogger<CatalogRefreshWorker> log)
    {
        _escopos = escopos;
        _relogio = relogio;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(Espera, _relogio, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return; // A API fechou antes da primeira rodada. Não é erro.
        }

        using var timer = new PeriodicTimer(Intervalo, _relogio);

        do
        {
            await RodarAsync(stoppingToken);
        }
        while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false));
    }

    private async Task RodarAsync(CancellationToken ct)
    {
        try
        {
            // Escopo novo por rodada: o DbContext é scoped, e este serviço vive o tempo da API.
            await using var escopo = _escopos.CreateAsyncScope();
            var atualizacao = escopo.ServiceProvider.GetRequiredService<CatalogRefresh>();

            var r = await atualizacao.RefreshStaleAsync(_relogio.GetUtcNow(), ct);
            if (r.Vencidas == 0) return;

            _log.LogInformation(
                "Catálogo: {Atualizadas} de {Vencidas} série(s) atualizada(s) pelo TMDB e pelo TVmaze.",
                r.Atualizadas, r.Vencidas);

            foreach (var falha in r.Falhas)
                _log.LogWarning("Catálogo: não atualizada, fica para a próxima rodada — {Falha}", falha);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // Desligando no meio da rodada. O que já foi gravado fica; o resto continua vencido.
        }
        catch (Exception ex)
        {
            // Sem rede, banco fora do ar: a rodada seguinte tenta de novo. Derrubar a API por
            // isso tiraria do ar o acervo inteiro por causa de um passo que é só manutenção.
            _log.LogWarning(ex, "Catálogo: a rodada de atualização falhou.");
        }
    }
}
