using Npgsql;

namespace Reprise.Infrastructure.Persistence;

/// <summary>
/// De onde vem a conexão com o banco, e em que formato.
///
/// <para>
/// Aceita os dois formatos que alguém vai colar aqui: o do Npgsql
/// (<c>Host=…;Database=…</c>) e a URL que os Postgres hospedados entregam
/// (<c>postgresql://usuario:senha@host/banco?sslmode=require</c> — Neon, Supabase, Render e cia.).
/// O Npgsql só entende o primeiro; sem a conversão, quem copia a URL do painel do Neon recebe um
/// "Format of the initialization string does not conform to specification" e não faz ideia do porquê.
/// </para>
///
/// <para>
/// A API, a CLI e o design-time do EF passam todos por aqui, para os três concordarem no padrão e
/// no formato — antes eram três cópias da mesma linha.
/// </para>
/// </summary>
public static class PostgresConnectionString
{
    /// <summary>O Postgres do docker-compose, visto da máquina (porta publicada no localhost).</summary>
    public const string LocalDefault = "Host=localhost;Port=5432;Database=reprise;Username=reprise;Password=reprise";

    /// <summary>
    /// A conexão configurada (ou <see cref="LocalDefault"/>, sem nenhuma), no formato do Npgsql.
    /// </summary>
    public static string Resolve(string? configured)
    {
        if (string.IsNullOrWhiteSpace(configured)) return LocalDefault;

        var value = configured.Trim();
        return IsUrl(value) ? FromUrl(value) : value;
    }

    /// <summary>Lê de <c>ConnectionStrings__Default</c>, que é o que a CLI e o design-time do EF têm.</summary>
    public static string FromEnvironment()
        => Resolve(Environment.GetEnvironmentVariable("ConnectionStrings__Default"));

    private static bool IsUrl(string value)
        => value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
           || value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase);

    private static string FromUrl(string value)
    {
        // O Uri não conhece o esquema postgres, mas separa usuário, host, porta, caminho e query
        // do mesmo jeito que faz com http — que é tudo o que precisamos dele.
        var uri = new Uri(value);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort || uri.Port <= 0 ? 5432 : uri.Port,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            // Sem GSS, como no compose: nenhum Postgres hospedado usa Kerberos, e o Npgsql tenta
            // por padrão — deixando um erro inofensivo no log a cada conexão.
            GssEncryptionMode = GssEncryptionMode.Disable,
            // Postgres hospedado de graça (o Neon) desliga o servidor depois de 5 minutos parado, e
            // a conexão que ficou no pool morre junto — a primeira consulta depois disso estouraria
            // "Exception while reading from stream". Com conexão ociosa fechada em 1 minuto, quando o
            // servidor desliga não sobrou nenhuma no pool, e a próxima já nasce acordando ele.
            ConnectionIdleLifetime = 60,
        };

        var userInfo = uri.UserInfo.Split(':', 2);
        if (userInfo[0].Length > 0) builder.Username = Uri.UnescapeDataString(userInfo[0]);
        if (userInfo.Length == 2) builder.Password = Uri.UnescapeDataString(userInfo[1]);

        foreach (var (key, raw) in Query(uri.Query))
        {
            switch (key.ToLowerInvariant())
            {
                case "sslmode":
                    builder.SslMode = SslModeFrom(raw);
                    break;
                case "channel_binding":
                    builder.ChannelBinding = Enum.Parse<ChannelBinding>(raw, ignoreCase: true);
                    break;
                // O resto (application_name, options…) não muda nada aqui; ignorar é melhor do que
                // recusar uma URL que funciona em qualquer outro cliente.
            }
        }

        return builder.ConnectionString;
    }

    private static IEnumerable<(string Key, string Value)> Query(string query)
    {
        foreach (var pair in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = pair.Split('=', 2);
            yield return (Uri.UnescapeDataString(parts[0]), parts.Length == 2 ? Uri.UnescapeDataString(parts[1]) : "");
        }
    }

    /// <summary>
    /// Os valores do libpq (<c>verify-full</c>) não batem um a um com os nomes do enum do Npgsql
    /// (<c>VerifyFull</c>).
    /// </summary>
    private static SslMode SslModeFrom(string raw) => raw.ToLowerInvariant() switch
    {
        "disable" => SslMode.Disable,
        "allow" => SslMode.Allow,
        "prefer" => SslMode.Prefer,
        "require" => SslMode.Require,
        "verify-ca" => SslMode.VerifyCA,
        "verify-full" => SslMode.VerifyFull,
        _ => throw new FormatException($"sslmode desconhecido na URL do banco: '{raw}'.")
    };
}
