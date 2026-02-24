# Backend Scaffold (Pivot V1)

This folder contains Phase 1 scaffolding artifacts for the backend-first pivot.

## Structure

- `contracts/openapi/`: contract-first API definitions for each service
- `schemas/`: SQL stubs for domain schemas and service-role boundaries

## Services (Target)

- `identity`
- `learning`
- `finance_mlm`

## Notes

- These files are draft implementation anchors, not finished production code.
- Treat contracts as the integration source of truth for upcoming service builds.
- Keep domain boundaries strict: no direct cross-domain writes unless explicitly designed.
