## What and why

<!-- What this PR changes and the reason behind it. Link the issue if there is one. -->

## How it was tested

<!-- Commands you ran, screens you checked. -->

## Checklist

- [ ] `dotnet test apps/api/Reprise.slnx` passes (or `scripts/testar-api.ps1` on Windows)
- [ ] `pnpm --filter @reprise/web lint`, `typecheck`, `test` and `pnpm e2e` pass
- [ ] Changed an API endpoint or DTO? Ran `pnpm --filter @reprise/web api:sync` and committed the result
- [ ] Changed the data model? Added an EF Core migration
