# Signal Inbox

This repository is the active root for the Signal Inbox pilot project.

Signal Inbox is structured around three product domains:

- `Capture`
- `Knowledge`
- `Review`

The implementation follows four stable layers:

- `Capture Layer`
- `Normalization Layer`
- `Knowledge Layer`
- `Review Layer`

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

## Database Smoke Test

Before running repository scripts, activate the Node version from `.nvmrc` (`22.22.2`) or an equivalent compatible Node 22 runtime.

Run the capture-to-inbox schema smoke test with:

`pnpm db:smoke`

Run the RSS source CRUD smoke test with:

`pnpm capture:smoke`

Run the RSS source sync smoke test with:

`pnpm capture-sync:smoke`

Run the Inbox query-path smoke test with:

`pnpm inbox:smoke`

Run the model-backed knowledge enrichment smoke test with:

`pnpm knowledge-enrichment:smoke`

The smoke test runs the real `@signal-inbox/db` migration entrypoint and then inserts the minimal V1 chain:

`Source -> CaptureEntry -> RawAsset -> Item -> Enrichment -> ItemGroup -> ItemGroupMember`

Local options:

- set `DATABASE_URL` to a disposable PostgreSQL database before running the command
- or leave `DATABASE_URL` unset and let the command start a temporary local PostgreSQL instance with `initdb`, `pg_ctl`, and `createdb`

CI expectation:

- provide `DATABASE_URL` that points at the CI job's temporary or disposable PostgreSQL database
- do not point the smoke test at a shared long-lived database
