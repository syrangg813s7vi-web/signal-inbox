# Signal Inbox

This repository is the active root for the Signal Inbox pilot project.

Current focus:

- keep the project docs here
- implement the first vertical slice
- evolve the product and architecture directly in this repository

Start with:

- `docs/project.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/progress.md`
- `docs/development-style.md`
- `docs/symphony-setup.md`
- `docs/issue-definition.md`

For Symphony orchestration:

- configure `WORKFLOW.md`
- set your real Linear project slug
- ensure `LINEAR_API_KEY` is available in the environment

## Monorepo Scaffold

The implementation scaffold uses:

- `pnpm` workspaces
- `apps/web` for the Next.js app shell
- `packages/*` for shared module boundaries

Current package boundaries:

- `packages/db`
- `packages/connectors`
- `packages/processors`
- `packages/ai`
- `packages/delivery`
- `packages/core`

## Local Development

Use Node `20.18+` or `22.x` and `pnpm`.

The repository includes `.node-version`, `.nvmrc`, and `.mise.toml` so the expected Node
runtime can be selected consistently across common version managers.

Initial setup:

1. `cp .env.example .env`
2. `docker compose up -d`
3. `mise install` (or activate the Node version from `.nvmrc` / `.node-version`)
4. `pnpm install`
5. `pnpm dev`
