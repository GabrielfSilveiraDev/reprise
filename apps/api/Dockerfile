# syntax=docker/dockerfile:1
#
# Imagens da API e da CLI, a partir da raiz do repositório:
#   docker build -f apps/api/Dockerfile --target api .
#   docker build -f apps/api/Dockerfile --target cli .
# O docker-compose.yml da raiz já faz isso.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Só os arquivos de projeto primeiro: o restore vira uma camada própria, refeita apenas quando uma
# dependência muda — e não a cada linha de código alterada.
COPY global.json ./
COPY apps/api/Directory.Build.props apps/api/Directory.Packages.props apps/api/
COPY apps/api/Reprise.Api/Reprise.Api.csproj apps/api/Reprise.Api/
COPY apps/api/Reprise.Application/Reprise.Application.csproj apps/api/Reprise.Application/
COPY apps/api/Reprise.Domain/Reprise.Domain.csproj apps/api/Reprise.Domain/
COPY apps/api/Reprise.Infrastructure/Reprise.Infrastructure.csproj apps/api/Reprise.Infrastructure/
COPY apps/api/Reprise.Importer/Reprise.Importer.csproj apps/api/Reprise.Importer/
RUN dotnet restore apps/api/Reprise.Api/Reprise.Api.csproj \
 && dotnet restore apps/api/Reprise.Importer/Reprise.Importer.csproj

COPY apps/api/ apps/api/
RUN dotnet publish apps/api/Reprise.Api/Reprise.Api.csproj -c Release --no-restore -o /out/api \
 && dotnet publish apps/api/Reprise.Importer/Reprise.Importer.csproj -c Release --no-restore -o /out/cli

# ---- API ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS api
WORKDIR /app
COPY --from=build /out/api .
# Usuário sem privilégios, já criado na imagem oficial. Porta 8080 é o padrão dela.
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Reprise.Api.dll"]

# ---- CLI (importação, enriquecimento, migrações, senha) ----
# Só o runtime base: a CLI não usa nada do ASP.NET Core, e a imagem sai bem menor.
FROM mcr.microsoft.com/dotnet/runtime:10.0 AS cli
WORKDIR /app
COPY --from=build /out/cli .
USER $APP_UID
ENTRYPOINT ["dotnet", "Reprise.Importer.dll"]
