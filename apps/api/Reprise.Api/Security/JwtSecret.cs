using System.Security.Cryptography;

namespace Reprise.Api.Security;

/// <summary>
/// De onde vem o segredo que assina os tokens.
///
/// <para>
/// Duas fontes, nesta ordem: <c>Jwt:Secret</c>, dito explicitamente (user-secrets, variável de
/// ambiente, o gerado pelo Render), e <c>Jwt:SecretFile</c>, um arquivo que a própria API cria na
/// primeira partida com um segredo aleatório e reaproveita dali em diante. O arquivo é o que deixa o
/// <c>docker compose up</c> funcionar sem ninguém abrir o <c>.env</c> e rodar <c>openssl</c> antes:
/// o compose aponta para um volume, e o segredo sobrevive a recriar o container. Trocar o segredo
/// só desloga todo mundo — nenhum dado depende dele —, então perder o volume não perde nada.
/// </para>
///
/// <para>
/// Sem nenhuma das duas a API continua se recusando a subir. Assinar com um segredo de exemplo,
/// embutido no código, seria pior do que não subir: qualquer um que leu o repositório forjaria tokens.
/// </para>
/// </summary>
public static class JwtSecret
{
    /// <summary>HMAC-SHA256 com chave menor que o hash enfraquece a assinatura; 32 bytes é o piso.</summary>
    public const int MinimumLength = 32;

    public static string Resolve(IConfiguration configuration)
    {
        var secret = configuration["Jwt:Secret"];
        if (!string.IsNullOrWhiteSpace(secret))
        {
            // Dito explicitamente e fraco é erro de quem configurou: falhar é melhor do que, por
            // exemplo, cair no arquivo e deixar a pessoa achando que o segredo dela está em uso.
            if (secret.Length < MinimumLength)
                throw new InvalidOperationException(
                    $"Jwt:Secret tem menos de {MinimumLength} caracteres. Gere um com: openssl rand -base64 48");
            return secret;
        }

        var file = configuration["Jwt:SecretFile"];
        if (!string.IsNullOrWhiteSpace(file)) return ReadOrCreate(file);

        throw new InvalidOperationException(
            "Jwt:Secret ausente. Gere um com `openssl rand -base64 48` e passe em Jwt__Secret, ou aponte " +
            "Jwt__SecretFile para um arquivo onde a API possa guardar um segredo gerado por ela.");
    }

    private static string ReadOrCreate(string path)
    {
        if (File.Exists(path))
        {
            var stored = File.ReadAllText(path).Trim();
            if (stored.Length >= MinimumLength) return stored;
            throw new InvalidOperationException(
                $"O segredo em {path} tem menos de {MinimumLength} caracteres. Apague o arquivo para a API gerar outro.");
        }

        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);
        var created = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));

        // CreateNew, e não Create: se outro processo criou o arquivo entre o Exists e aqui, vale o
        // dele — sobrescrever invalidaria os tokens que ele já assinou.
        try
        {
            using var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write);
            using var writer = new StreamWriter(stream);
            writer.Write(created);
        }
        catch (IOException) when (File.Exists(path))
        {
            return ReadOrCreate(path);
        }

        // Só o dono lê: é a chave que forja qualquer sessão.
        if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
        return created;
    }
}
