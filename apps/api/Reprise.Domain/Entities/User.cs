using Microsoft.AspNetCore.Identity;

namespace Reprise.Domain.Entities;

/// <summary>
/// Dono dos dados (tenant) e, agora, também a identidade de login.
///
/// <para>
/// Herda <see cref="IdentityUser{TKey}"/> com <see cref="Guid"/> e continua mapeada na <b>mesma
/// tabela <c>users</c></b>. Isso é deliberado: o <c>Id</c> é a chave de tenant de
/// <c>tracked_series</c>, <c>watch_events</c>, <c>import_runs</c> e <c>processed_actions</c>.
/// Uma tabela de identidade separada obrigaria a remapear dezenas de milhares de linhas para um id
/// novo — e um erro ali desconectaria o histórico do dono, que é o único dado deste projeto que
/// não dá para recomprar.
/// </para>
///
/// <para>
/// O <see cref="IdentityUser{TKey}"/> já traz <c>Email</c>, <c>UserName</c>, <c>PasswordHash</c>,
/// <c>SecurityStamp</c> e o resto. O que sobra aqui é o que é do Reprise.
/// </para>
/// </summary>
public class User : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Sessões ativas deste usuário — ver <see cref="RefreshToken"/>.</summary>
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
