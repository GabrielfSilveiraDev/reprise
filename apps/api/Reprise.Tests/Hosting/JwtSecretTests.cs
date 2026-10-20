using Microsoft.Extensions.Configuration;
using Reprise.Api.Security;

namespace Reprise.Tests.Hosting;

public sealed class JwtSecretTests : IDisposable
{
    private readonly string _pasta = Path.Combine(Path.GetTempPath(), "reprise-jwt-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        if (Directory.Exists(_pasta)) Directory.Delete(_pasta, recursive: true);
    }

    private static IConfiguration Config(string? secret = null, string? file = null) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:Secret"] = secret, ["Jwt:SecretFile"] = file })
            .Build();

    [Fact]
    public void Segredo_explicito_vence_o_arquivo()
    {
        var secret = new string('x', 40);
        var file = Path.Combine(_pasta, "jwt");

        Assert.Equal(secret, JwtSecret.Resolve(Config(secret, file)));
        Assert.False(File.Exists(file));
    }

    [Fact]
    public void Segredo_explicito_curto_e_recusado()
    {
        Assert.Throws<InvalidOperationException>(() => JwtSecret.Resolve(Config("curto")));
    }

    [Fact]
    public void Sem_segredo_nem_arquivo_a_API_nao_sobe()
    {
        Assert.Throws<InvalidOperationException>(() => JwtSecret.Resolve(Config()));
    }

    [Fact]
    public void Arquivo_e_criado_na_primeira_partida_e_reaproveitado_nas_seguintes()
    {
        // A pasta nem existe ainda: é o volume novo do compose, na primeira subida.
        var file = Path.Combine(_pasta, "segredos", "jwt");

        var primeira = JwtSecret.Resolve(Config(file: file));
        var segunda = JwtSecret.Resolve(Config(file: file));

        Assert.True(primeira.Length >= JwtSecret.MinimumLength);
        Assert.Equal(primeira, segunda);
        Assert.Equal(primeira, File.ReadAllText(file));
    }

    [Fact]
    public void Arquivo_com_segredo_curto_e_recusado()
    {
        Directory.CreateDirectory(_pasta);
        var file = Path.Combine(_pasta, "jwt");
        File.WriteAllText(file, "curto");

        Assert.Throws<InvalidOperationException>(() => JwtSecret.Resolve(Config(file: file)));
    }
}
