# syntax=docker/dockerfile:1
#
# O web compilado, servido por nginx — que também repassa /api/* para a API, como o Vite faz em
# desenvolvimento. A partir da raiz do repositório:
#   docker build -f apps/web/Dockerfile .

FROM node:24-alpine AS build
WORKDIR /src
# O corepack instala exatamente o pnpm declarado em `packageManager` no package.json da raiz.
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

COPY apps/web/ apps/web/
RUN pnpm --filter @reprise/web build

# ---- Servidor ----
# Variante sem root do nginx oficial: escuta na 8080 e não roda como administrador.
FROM nginxinc/nginx-unprivileged:1.30-alpine AS web
# Para onde /api/* vai. No compose, o serviço `api`.
ENV API_UPSTREAM=http://api:8080
# A imagem troca ${API_UPSTREAM} pelo valor na partida (templates/*.template → conf.d/).
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /src/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
