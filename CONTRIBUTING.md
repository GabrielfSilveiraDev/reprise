# Contributing to Reprise

Thanks for your interest! Reprise is a personal project, but bug reports, ideas and pull requests
are welcome.

## Before you start

- **Bugs and ideas:** open an [issue](https://github.com/GabrielfSilveiraDev/reprise/issues/new/choose).
  Portuguese or English are both fine.
- **Larger changes:** open an issue first so we can agree on the approach before you spend time
  on it.
- **Security issues:** don't open a public issue — follow [SECURITY.md](SECURITY.md).

## Setting up

The [development guide](docs/desenvolvimento.md) (in Portuguese) covers running the API and the
web app locally, the database migrations and the test suites. In short:

```bash
docker compose up -d db
dotnet user-secrets set "Jwt:Secret" "$(openssl rand -base64 48)" --project apps/api/Reprise.Api
dotnet run --project apps/api/Reprise.Importer -- migrate
dotnet run --project apps/api/Reprise.Api
pnpm install && pnpm dev
```

## Conventions

- **Code comments, docs and commit messages are in Portuguese.** Comments explain *why*, not
  *what* — the surrounding code shows the style.
- **Commits** are small and self-contained, with a subject in the imperative-ish present tense
  ("Corrige…", "Mostra…") and a body explaining the reason when it isn't obvious.
- **API:** follow the vertical slices in `Reprise.Application/Features`. Package versions live in
  `apps/api/Directory.Packages.props`, and build warnings are errors.
- **Web:** business rules go in `src/domain`, as tested classes; screens only use them. Changed an
  endpoint or DTO? Regenerate the client types with `pnpm --filter @reprise/web api:sync`.
- **Data model:** changes need an EF Core migration. `watch_events` is the source of truth — a
  change that could lose or detach watch events needs a very good reason.

## Pull requests

Before opening one, make sure these pass (CI runs them too):

```bash
dotnet test apps/api/Reprise.slnx
pnpm --filter @reprise/web lint
pnpm --filter @reprise/web typecheck
pnpm test
pnpm e2e
```

On Windows with Smart App Control, run the API tests with `scripts/testar-api.ps1` instead — see
[docs/windows.md](docs/windows.md).

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
