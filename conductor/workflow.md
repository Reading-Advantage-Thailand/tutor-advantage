# Workflow

## Guiding Rules

1. `plan.md` is the source of truth for execution order and status.
2. Follow TDD: write failing tests, implement, then refactor.
3. Keep service boundaries intact (`identity`, `learning`, `finance/mlm`).
4. Use non-interactive CI-safe commands.
5. Commit in small atomic units per completed task.

## Task Lifecycle

1. Select next pending task from `plan.md`.
2. Mark task `[~]` before coding.
3. Write failing tests (red).
4. Implement minimal passing code (green).
5. Refactor while preserving behavior.
6. Run lint, typecheck, tests, and coverage.
7. Mark task `[x]` when done.

## Quality Gates

- All tests pass.
- Lint and type checks pass.
- New code has tests and meaningful assertions.
- No cross-service boundary violations.
- Finance/MLM logic changes include settlement regression tests.

## Commit Conventions

- Use conventional commit messages.
- Keep one logical change per commit.
- Include migration notes when changing settlement or payout behavior.

## Verification Expectations

- For backend changes: API contract tests + integration tests for money movement paths.
- For finance changes: deterministic replay tests for settlement periods.
- For URL compatibility: regression tests for legacy article URL resolution.

## Default Command Set

```bash
npm run lint
npm run build
npm test
```
