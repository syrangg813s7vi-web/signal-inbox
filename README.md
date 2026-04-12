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

- keep the project docs current
- implement the first RSS vertical slice on top of the scaffolded monorepo
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

## Repository Layout

- `apps/web`
  - Next.js app shell for Home, Inbox, Knowledge, Digest, Sources, and Settings
- `packages/db`
  - database schema, migrations, and db client
- `packages/capture`
  - source management, capture entries, and raw asset orchestration
- `packages/connectors`
  - source-specific fetch logic
- `packages/normalization`
  - extraction and RawAsset-to-Item transformation
- `packages/knowledge`
  - item enrichment, note creation, and knowledge sink sync
- `packages/processors`
  - reusable knowledge-processing step placeholders in the fixed V1 order
- `packages/review`
  - digest generation and review selection
- `packages/ai`
  - AI provider abstraction and prompt orchestration
- `packages/delivery`
  - lightweight delivery adapters
- `packages/core`
  - shared orchestration and job coordination

## Local Development

Requirements:

- Node.js 22+
- pnpm 9+
- Docker Compose

Install the pinned Node version first:

```bash
mise install
mise exec -- node -v
```

Or with `nvm`:

```bash
nvm use
```

The most reliable way to run repo commands is through `mise exec -- ...` so the pinned Node 22 toolchain is used even if your shell default is older.

Install dependencies:

```bash
mise exec -- pnpm install
```

Start local services:

```bash
mise exec -- pnpm dev:services
```

Environment variables:

- copy `.env.example` to `.env`
- fill in `OPENAI_API_KEY` when AI-backed features start landing

Run the web app:

```bash
mise exec -- pnpm dev
```

Other useful commands:

```bash
mise exec -- pnpm validate
mise exec -- pnpm dev:services:stop
```

If your shell is already using Node 22 directly, the same commands also work without `mise exec --`.
