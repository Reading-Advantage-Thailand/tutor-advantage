# Article assessments

## Content and delivery

Every catalog article has a versioned PRE and POST form. Each form contains five vocabulary, five reading, and five listening questions. Public manifests and all listening audio are served from the `tutor_advantage_bucket` Cloud Storage bucket. The student application does not bundle assessment audio.

The public index is:

`https://storage.googleapis.com/tutor_advantage_bucket/assessments/articles/index-v1.json`

Public manifests contain prompts, options, passages, and audio URLs only. Correct choices remain in `services/learning-service/src/services/assessment-answer-keys.v1.json` and are packaged only with the learning service. The service resolves the immutable manifest version from that private key catalog, validates the downloaded manifest, and caches it in memory.

Run `npm run assessments:generate -- --validate-only` to rebuild and validate content locally. Add `--upload` only when intentionally publishing a new content version. Generated public manifests under `packages/database/assessment-manifests/public/` are ignored because Cloud Storage is their delivery source.

## Teacher-controlled workflow

- The tutor selects Lesson, PRE, or POST in the Lobby. The shared start button starts the selected activity.
- Students remain in the normal Lobby, see the upcoming activity, and press Ready before the tutor can start.
- Answers save individually and resume when reconnecting to the same room.
- The tutor finishes the form. Only complete drafts are graded.
- Results are scoped by class book cycle, article, student, and stage. Different articles never overwrite one another.
- Starting POST closes PRE for that article only.
- Reports can switch between articles and show paired PRE/POST results for the selected article.

## Persistence and deployment

Apply migrations through the normal deployment pipeline before deploying the service:

```sh
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
npx prisma generate --schema=packages/database/prisma/schema.prisma
```

Do not use `db push`. The article-assessment migration backfills any existing pilot attempts from their interactive session article ID. Rows that cannot be linked retain the explicit `legacy-primary-origins2` article ID.

Recommended verification:

```sh
npm test
npm run contract:check
npm run lint
npm run build:services
npm run build
```
