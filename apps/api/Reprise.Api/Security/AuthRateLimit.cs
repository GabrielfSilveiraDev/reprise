using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace Reprise.Api.Security;

/// <summary>
/// Limite de tentativas nas rotas de autenticação que aceitam palpite: login, cadastro, código de
/// validação e reenvio do código. Por endereço de origem, em janelas de um minuto.
///
/// <para>
/// <b>Por que existe.</b> Sem limite, o login aceita tentativas de senha sem fim, e o código de
/// seis dígitos tem só um milhão de combinações — adivinhável em horas por quem insiste. O reenvio
/// também manda e-mail, e sem freio vira um jeito de encher a caixa de alguém.
/// </para>
///
/// <para>
/// <b>Por que fora do refresh e do logout.</b> O refresh token é aleatório e longo demais para
/// adivinhar, e o cliente web o renova sozinho — limitá-lo só arriscaria deslogar quem tem várias
/// abas abertas, sem proteger nada.
/// </para>
///
/// <para>
/// <b>Atrás de proxy reverso</b> (o nginx do docker-compose, por exemplo), o endereço de origem é
/// o do proxy, e todo mundo cairia na mesma cota. É o <c>ASPNETCORE_FORWARDEDHEADERS_ENABLED</c>
/// que faz a API ler o endereço real no <c>X-Forwarded-For</c> — ligado no compose, onde a API só é
/// alcançável pelo proxy. Numa API exposta direto, deixe-o desligado: qualquer um forjaria o
/// cabeçalho para ganhar cota nova.
/// </para>
/// </summary>
public static class AuthRateLimit
{
    public const string PolicyName = "auth-attempts";

    /// <summary>Tentativas por minuto e por endereço. Configurável em <c>Api:AuthAttemptsPerMinute</c>.</summary>
    public const int DefaultPermitsPerMinute = 10;

    public static IServiceCollection AddRepriseAuthRateLimit(this IServiceCollection services, IConfiguration configuration)
    {
        var permits = configuration.GetValue("Api:AuthAttemptsPerMinute", DefaultPermitsPerMinute);

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // O `Retry-After` diz ao cliente quanto esperar, em vez de deixá-lo tentar às cegas.
            options.OnRejected = (context, _) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter =
                        Math.Ceiling(retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);
                }
                return ValueTask.CompletedTask;
            };

            options.AddPolicy(PolicyName, http => RateLimitPartition.GetFixedWindowLimiter(
                http.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = permits,
                    Window = TimeSpan.FromMinutes(1),
                    // Sem fila: segurar a requisição até a próxima janela só daria a quem ataca um
                    // jeito de manter conexões abertas.
                    QueueLimit = 0
                }));
        });

        return services;
    }
}
