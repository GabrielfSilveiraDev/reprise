namespace Reprise.Infrastructure.Auth;

public sealed class JwtOptions
{
    /// <summary>
    /// Segredo de assinatura. <b>Não tem valor padrão de propósito:</b> um padrão embutido é a
    /// origem clássica do "subiu em produção com a chave do exemplo". Ausente, a API se recusa a
    /// iniciar — falhar alto na partida é melhor do que assinar token com segredo conhecido.
    /// </summary>
    public string Secret { get; set; } = string.Empty;

    public string Issuer { get; set; } = "reprise";
    public string Audience { get; set; } = "reprise-clients";

    /// <summary>
    /// Curto por design. O par acesso+refresh existe justamente para que um token vazado valha
    /// pouco tempo; alongar isto desfaz o motivo de haver refresh.
    /// </summary>
    public TimeSpan AccessTokenLifetime { get; set; } = TimeSpan.FromMinutes(30);

    /// <summary>
    /// Longo, porque é ele que evita pedir senha no meio de uma série. Fica no cofre do aparelho,
    /// é guardado só como hash no servidor e gira a cada uso.
    /// </summary>
    public TimeSpan RefreshTokenLifetime { get; set; } = TimeSpan.FromDays(60);

    /// <summary>
    /// Quando falso, qualquer pessoa com o endereço da API cria conta. Num app pessoal exposto
    /// por túnel, isso é uma porta aberta — então o padrão é fechado, e abrir é decisão explícita.
    /// </summary>
    public bool AllowRegistration { get; set; }
}
