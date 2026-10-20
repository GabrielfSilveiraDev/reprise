using System.Text.Json;

namespace Reprise.Api.Hosting;

/// <summary>
/// O <c>/.well-known/assetlinks.json</c>: a prova, para o Android, de que o APK do Reprise e este
/// site são do mesmo dono.
///
/// <para>
/// O APK é uma Trusted Web Activity — abre o site em tela cheia, no Chrome. Sem esta prova, o Chrome
/// mostra a barra de endereço por cima do app, como faria com qualquer site aberto por outro
/// aplicativo. A prova é a impressão digital (SHA-256) do certificado que assinou o APK, e ela é de
/// quem hospeda: cada instalação assina o próprio APK com a própria chave. Por isso vem da
/// configuração (<c>Android__CertFingerprints</c>), e não de um arquivo no repositório.
/// </para>
///
/// <para>
/// Sem impressão configurada, a rota não existe (404) e o app funciona do mesmo jeito, só que com a
/// barra de endereço.
/// </para>
/// </summary>
public static class AndroidAppLinks
{
    public const string Path = "/.well-known/assetlinks.json";

    /// <summary>
    /// O mesmo pacote que o workflow do APK usa por padrão (<c>.github/workflows/android.yml</c>).
    /// Quem trocar lá troca aqui, por <c>Android__PackageName</c>.
    /// </summary>
    public const string DefaultPackageName = "io.github.gabrielfsilveiradev.reprise";

    public static IApplicationBuilder UseAndroidAppLinks(this IApplicationBuilder app)
    {
        var configuration = app.ApplicationServices.GetRequiredService<IConfiguration>();
        var fingerprints = (configuration["Android:CertFingerprints"] ?? "")
            .Split([',', ';', ' ', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (fingerprints.Length == 0) return app;

        var packageName = configuration["Android:PackageName"] is { Length: > 0 } configured
            ? configured
            : DefaultPackageName;

        // O formato é o da documentação do Digital Asset Links; montado uma vez, na partida.
        var body = JsonSerializer.Serialize(new[]
        {
            new
            {
                relation = new[] { "delegate_permission/common.handle_all_urls" },
                target = new
                {
                    @namespace = "android_app",
                    package_name = packageName,
                    sha256_cert_fingerprints = fingerprints.Select(f => f.ToUpperInvariant()).ToArray(),
                },
            },
        });

        return app.Use((context, next) =>
        {
            if (!context.Request.Path.Equals(Path, StringComparison.OrdinalIgnoreCase)) return next(context);

            context.Response.ContentType = "application/json";
            return context.Response.WriteAsync(body);
        });
    }
}
