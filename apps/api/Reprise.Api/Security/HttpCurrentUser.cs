using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Reprise.Application.Abstractions;

namespace Reprise.Api.Security;

/// <summary>
/// O tenant atual, lido do <c>sub</c> do JWT.
///
/// <para>
/// É esta classe que transforma a fundação multi-tenant em multiusuário de verdade: os filtros
/// globais do EF Core sempre compararam <c>user_id</c> com <c>ICurrentUser.UserId</c>, e até
/// agora essa propriedade devolvia uma constante. Trocar a implementação basta — nenhuma consulta
/// precisou mudar, que era o ponto de ter feito assim desde o começo.
/// </para>
///
/// <para>
/// Sem requisição autenticada, devolve <see cref="Guid.Empty"/>. Não é um usuário: é um id que não
/// casa com nada, então uma rota desprotegida por engano devolve lista vazia em vez de dados de
/// outra pessoa. Falhar fechado.
/// </para>
/// </summary>
public sealed class HttpCurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _accessor;

    public HttpCurrentUser(IHttpContextAccessor accessor) => _accessor = accessor;

    public Guid UserId
    {
        get
        {
            var principal = _accessor.HttpContext?.User;
            if (principal?.Identity?.IsAuthenticated != true) return Guid.Empty;

            // O handler do JwtBearer remapeia `sub` para ClaimTypes.NameIdentifier por padrão;
            // aceitar os dois evita depender desse detalhe de configuração.
            var raw = principal.FindFirstValue(ClaimTypes.NameIdentifier)
                      ?? principal.FindFirstValue(JwtRegisteredClaimNames.Sub);

            return Guid.TryParse(raw, out var id) ? id : Guid.Empty;
        }
    }
}
