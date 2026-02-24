# SQL Schema Stubs (Phase 1)

These files are draft stubs for the backend-first pivot.

## Files

- `001_schemas_and_roles.sql`: creates schemas and least-privilege service roles
- `identity.sql`: identity domain starter tables
- `learning.sql`: learning domain starter tables
- `finance_mlm.sql`: finance/mlm domain starter tables

## Intended Use

1. Apply `001_schemas_and_roles.sql` first.
2. Apply domain SQL files in dependency order (`identity`, `learning`, `finance_mlm`).
3. Refine indexes, constraints, and partitioning in implementation phases.

## Notes

- Monetary amounts are modeled in minor units (`BIGINT`) to avoid floating point drift.
- Precision commission math should be computed in application code using decimal libraries and persisted as deterministic snapshots.
- `legacy_bridge` schema is reserved for URL/content compatibility adapters.
