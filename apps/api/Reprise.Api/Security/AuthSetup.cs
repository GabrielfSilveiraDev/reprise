using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using Reprise.Application.Abstractions;
using Reprise.Domain.Entities;
using Reprise.Infrastructure;
using Reprise.Infrastructure.Auth;
using Reprise.Infrastructure.Email;
using Reprise.Infrastructure.Persistence;

namespace Reprise.Api.Security;

public static class AuthSetup
{
    /// <summary>
    /// Liga o Identity, o JWT e o tenant vindo do token.
    ///
    /// Mora na API, e não na Infrastructure, porque configura o pipeline HTTP — a Infrastructure
    /// guarda o <see cref="AuthService"/>, que só sabe de banco e de hash. O importador roda na
    /// máquina do dono, sem HTTP e sem token, e continua com o usuário-semente.
    /// </summary>
    public static IServiceCollection AddRepriseAuth(this IServiceCollection services, IConfiguration configuration)
    {
        var secret = configuration["Jwt:Secret"];
        if (string.IsNullOrWhiteSpace(secret) || secret.Length < 32)
        {
            // Falhar na partida é melhor do que assinar token com segredo fraco ou de exemplo.
            throw new InvalidOperationException(
                "Jwt:Secret ausente ou com menos de 32 caracteres. Gere um com: openssl rand -base64 48");
        }

        var issuer = configuration["Jwt:Issuer"] ?? "reprise";
        var audience = configuration["Jwt:Audience"] ?? "reprise-clients";

        services.Configure<JwtOptions>(o =>
        {
            o.Secret = secret;
            o.Issuer = issuer;
            o.Audience = audience;
            o.AllowRegistration = configuration.GetValue("Jwt:AllowRegistration", false);
        });

        // A política de senha mora em AddRepriseIdentityCore, compartilhada com a CLI.
        // AddDefaultTokenProviders traz o EmailTokenProvider, que gera o código de seis dígitos.
        services.AddRepriseIdentityCore().AddRoles<IdentityRole<Guid>>().AddDefaultTokenProviders();

        services.Configure<SmtpOptions>(o =>
        {
            o.Host = configuration["Smtp:Host"] ?? o.Host;
            o.Port = configuration.GetValue("Smtp:Port", o.Port);
            o.User = configuration["Smtp:User"] ?? o.User;
            o.Password = configuration["Smtp:Password"] ?? o.Password;
            o.FromAddress = configuration["Smtp:FromAddress"] ?? o.FromAddress;
            o.FromName = configuration["Smtp:FromName"] ?? o.FromName;
            o.UseSsl = configuration.GetValue("Smtp:UseSsl", o.UseSsl);
        });
        services.AddScoped<IEmailSender, SmtpEmailSender>();

        services.AddSingleton(TimeProvider.System);
        services.AddScoped<AuthService>();

        services.AddHttpContextAccessor();
        // Substitui o SeedCurrentUser que AddRepriseInfrastructure registra: o último vence.
        services.AddScoped<ICurrentUser, HttpCurrentUser>();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = issuer,
                    ValidAudience = audience,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
                    // Sem tolerância de relógio: o padrão de 5 minutos estende a vida de um token
                    // expirado justamente quando a expiração curta é o ponto do desenho.
                    ClockSkew = TimeSpan.Zero
                };
            });

        services.AddAuthorization();
        return services;
    }
}
