# Security policy

## Supported versions

Reprise has no numbered releases yet. Security fixes land on the `main` branch — keep your
instance updated from it.

## Reporting a vulnerability

Please **don't** open a public issue. Report it privately through
[GitHub's private vulnerability reporting](https://github.com/GabrielfSilveiraDev/reprise/security/advisories/new),
with the steps to reproduce and the impact you see.

You can expect an acknowledgement within a week. Once a fix is ready, the advisory is published
with credit to you, unless you prefer to stay anonymous.

## Deployment notes

Reprise is meant to be self-hosted. If you expose it beyond your local network:

- Serve it over **HTTPS** (a reverse proxy such as Caddy or Traefik in front of the `web` service).
- Use a strong, unique `Jwt__Secret` (`openssl rand -base64 48`) and change the default Postgres
  password in `.env`.
- Keep `Jwt__AllowRegistration=false` unless you really want open sign-ups.
- Don't publish the API or Postgres ports to the network. The compose file exposes only `web`
  (Postgres is bound to `127.0.0.1`, for local development), and the API trusts
  `X-Forwarded-For` because it is only reachable through that proxy.
