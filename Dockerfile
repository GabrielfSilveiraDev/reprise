# syntax=docker/dockerfile:1
#
# O Reprise inteiro numa imagem: a API servindo também o cliente web (ver WebClientHosting).
# É a mesma imagem no docker-compose e na hospedagem (render.yaml). A partir da raiz:
#   docker build -t reprise .                 # o app (último estágio: é o que o Render constrói)
#   docker build -t reprise-cli --target cli .  # a CLI: migrações, importação, senha

# ---- Cliente web ----
FROM node:24-alpine AS web-build
WORKDIR /src
# O corepack instala exatamente o pnpm declarado em `packageManager` no package.json da raiz.
RUN corepack enable

# Só os manifestos primeiro: o install vira uma camada própria, refeita apenas quando uma
# dependência muda — e não a cada linha de código alterada.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

COPY apps/web/ apps/web/
RUN pnpm --filter @reprise/web build

# ---- API e CLI ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api-build
WORKDIR /src

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

# ---- CLI (importação, enriquecimento, migrações, senha) ----
# Só o runtime base: a CLI não usa nada do ASP.NET Core, e a imagem sai bem menor.
FROM mcr.microsoft.com/dotnet/runtime:10.0 AS cli
WORKDIR /app
COPY --from=api-build /out/cli .
USER $APP_UID
ENTRYPOINT ["dotnet", "Reprise.Importer.dll"]

# ---- App: API + cliente web ----
# Fica por último de propósito: o Render não deixa escolher o estágio e constrói o último.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS app
WORKDIR /app
COPY --from=api-build /out/api .
COPY --from=web-build /src/apps/web/dist ./wwwroot
# Onde a API guarda o segredo dos tokens que ela mesma gera (Jwt__SecretFile, no compose). A pasta
# nasce do usuário sem privilégios: um volume novo montado aqui herda o dono da pasta da imagem.
RUN mkdir /data && chown $APP_UID /data
# Usuário sem privilégios, já criado na imagem oficial. Porta 8080 é o padrão dela.
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Reprise.Api.dll"]
