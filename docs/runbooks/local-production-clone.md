# Local production data clone

Use `npm run db:clone:local` to refresh the local test database with a sanitized snapshot.

## Before running

- Start Cloud SQL Auth Proxy on `127.0.0.1:5432` for the Production Cloud SQL instance.
- In the ignored root `.env`, set `PRODUCTION_DATABASE_URL` and `PRODUCTION_DATABASE_URL_READING_ADVANTAGE` to read-only database connections through that proxy.
- Keep `DATABASE_URL` on local PostgreSQL at `127.0.0.1:5433`. The command creates new local databases and switches these runtime URLs only after the copy and checks succeed.
- Optionally set `LOCAL_TEST_ACCOUNT_EMAIL` to one developer account. That account keeps its email and Google identity so it can sign in locally; all other accounts are anonymized.

## What the clone includes

- All rows from the Production `identity`, `learning`, and `finance_mlm` schemas. UUIDs are remapped, user names and emails are replaced, student birth dates are reduced to age bands, and comments, messages, payment payloads, meeting links, and identity documents are removed or replaced. Relationships, statuses, scores, timestamps, and financial amounts remain available for realistic testing.
- The `article`, `MultipleChoiceQuestion`, and `ShortAnswerQuestion` content tables from Reading Advantage. Reading Advantage accounts, authentication tokens, licenses, and student activity tables are excluded.
- Data is streamed through the process and inserted into local PostgreSQL; the command does not write a Production dump file.

## Refresh behavior

The first run creates `tutor_advantage_local_clone` and `reading_advantage_local_clone`. If those databases already exist, the command stops. To intentionally replace those local clone databases on a later run, use:

```powershell
npm run db:clone:local -- --replace-existing
```

The replacement flag drops only the two clone databases on local port 5433. It never writes to the Production connection. Restart local dev servers after a successful clone so they pick up the new URLs from `.env`.
