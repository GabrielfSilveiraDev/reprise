using Npgsql;
using Reprise.Infrastructure.Persistence;

namespace Reprise.Tests.Hosting;

public class PostgresConnectionStringTests
{
    [Fact]
    public void Sem_nada_configurado_vale_o_banco_do_compose()
    {
        Assert.Equal(PostgresConnectionString.LocalDefault, PostgresConnectionString.Resolve(null));
        Assert.Equal(PostgresConnectionString.LocalDefault, PostgresConnectionString.Resolve("  "));
    }

    [Fact]
    public void Formato_do_Npgsql_passa_como_veio()
    {
        const string conn = "Host=db;Port=5432;Database=reprise;Username=reprise;Password=reprise";
        Assert.Equal(conn, PostgresConnectionString.Resolve(conn));
    }

    [Fact]
    public void URL_do_Neon_vira_o_formato_do_Npgsql()
    {
        // O formato exato que o painel do Neon entrega para copiar.
        var resolved = PostgresConnectionString.Resolve(
            "postgresql://neondb_owner:npg_abc123@ep-cool-rain-a5b6c7d8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require");

        var conn = new NpgsqlConnectionStringBuilder(resolved);
        Assert.Equal("ep-cool-rain-a5b6c7d8.us-east-1.aws.neon.tech", conn.Host);
        Assert.Equal(5432, conn.Port);
        Assert.Equal("neondb", conn.Database);
        Assert.Equal("neondb_owner", conn.Username);
        Assert.Equal("npg_abc123", conn.Password);
        Assert.Equal(SslMode.Require, conn.SslMode);
        Assert.Equal(ChannelBinding.Require, conn.ChannelBinding);
        // Conexão ociosa sai do pool antes de o servidor gratuito desligar (ver o comentário lá).
        Assert.Equal(60, conn.ConnectionIdleLifetime);
    }

    [Fact]
    public void Senha_com_caracteres_escapados_e_porta_explicita()
    {
        var resolved = PostgresConnectionString.Resolve("postgres://eu:p%40ss%3Aw%2Fd@db.exemplo.com:6543/meu%20banco?sslmode=verify-full");

        var conn = new NpgsqlConnectionStringBuilder(resolved);
        Assert.Equal("p@ss:w/d", conn.Password);
        Assert.Equal(6543, conn.Port);
        Assert.Equal("meu banco", conn.Database);
        Assert.Equal(SslMode.VerifyFull, conn.SslMode);
    }

    [Fact]
    public void Sslmode_desconhecido_e_recusado_com_o_motivo()
    {
        var erro = Assert.Throws<FormatException>(() =>
            PostgresConnectionString.Resolve("postgresql://u:p@h/db?sslmode=quase"));
        Assert.Contains("quase", erro.Message);
    }
}
