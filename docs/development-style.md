# Development Style

## Goal

This document defines the default coding and git conventions for Signal Inbox.

The goal is consistency, readability, and low decision overhead for both human contributors and Codex.

## General Principles

- prefer clarity over cleverness
- prefer explicit boundaries over shared hidden behavior
- prefer small focused changes over broad rewrites
- prefer stable naming over introducing new synonyms
- keep the code aligned with the product principle of low friction
- keep a PR coherent rather than stacking avoidable repair commits for regressions introduced earlier in the same PR

## Core Naming Rules

Use the domain terms already defined in the project docs:

- `Source`
- `SourceSyncState`
- `CaptureEntry`
- `RawAsset`
- `Item`
- `Enrichment`
- `ItemGroup`
- `Note`
- `Digest`
- `ReviewObject`
- `KnowledgeDestination`
- `DeliveryDestination`
- `DeliveryLog`

Do not introduce alternative names such as:

- `Document` for `Item`
- `Feed` for `Source`
- `Destination` as a single catch-all name for both knowledge preservation and lightweight delivery
- `Artifact` for a core content object

Use:

- `KnowledgeDestination` for knowledge sinks
- `DeliveryDestination` for lightweight outbound channels

## TypeScript Style

- use TypeScript everywhere
- prefer explicit types at module boundaries
- use `interface` for long-lived domain shapes
- use `type` for unions, mapped types, and narrower utility shapes
- avoid `any`
- prefer `unknown` over `any` when input is untrusted
- keep functions small and purpose-specific
- prefer early returns over deep nesting
- avoid hidden mutation when a returned value is clearer

## File and Module Style

- one module should have one clear responsibility
- avoid mixing UI, data access, and business logic in the same file
- keep source-specific capture logic inside `capture` or `connectors`
- keep normalization logic separate from knowledge processing logic
- keep knowledge sink logic separate from delivery sink logic
- keep view shaping in web query or view-model layers

Recommended file naming:

- kebab-case for file names
- PascalCase only for React component names and exported domain types when appropriate

## Directory Placement Rules

Use stable placement rules so contributors and Codex can predict where work belongs.

Recommended structure:

- `apps/web/app`
  - page routes
  - route handlers
- `apps/web/components`
  - UI components
  - page-specific presentational components
- `apps/web/lib`
  - client-safe helpers
  - formatters
  - view-model helpers
- `apps/web/server`
  - server queries
  - server actions
- `packages/db`
  - schema
  - migrations
  - db client
- `packages/capture`
  - source management
  - capture entry creation
- `packages/connectors`
  - source-specific fetch logic
- `packages/normalization`
  - extraction
  - transcription
  - OCR
  - raw asset to item transformation
- `packages/knowledge`
  - item enrichment
  - note creation
  - knowledge sink sync
- `packages/review`
  - digest generation
  - reminder and review generation
- `packages/ai`
  - provider abstraction
  - prompts
  - task routing
- `packages/delivery`
  - lightweight delivery adapters
- `packages/core`
  - shared orchestration and job coordination

Placement rules:

- do not place connector logic in web routes
- do not place normalization or knowledge-processing logic in UI components
- do not place knowledge sink formatting in delivery adapters
- do not place raw SQL or schema definitions inside page files
- do not place page-specific view shaping inside domain packages unless it is broadly reusable

## Vercel Directory Rules

The repository remains a monorepo when deployed through Vercel.

Vercel uses `apps/web` as the website deployment entrypoint, but the whole repository remains the source of truth.

### Repository Root

Keep monorepo-wide configuration in the repository root.

Examples:

- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `.nvmrc` or `.node-version`
- `.npmrc`
- `.env.example`
- `vercel.json` when Vercel needs repository-level configuration

### apps/web

Keep website-specific code and website-specific build configuration in `apps/web`.

Examples:

- routes and pages
- route handlers
- components
- styles
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `next.config.*`
- `postcss.config.*`
- `tailwind.config.*`
- `components.json`
- app-specific `lib` and `server` folders

### packages/*

Keep shared logic in `packages/*`.

Examples:

- `db`
- `ai`
- `capture`
- `connectors`
- `normalization`
- `knowledge`
- `review`
- `delivery`
- `core`

Vercel-specific constraints:

- do not flatten the monorepo into a single app directory just for deployment
- do not move repository-wide config into `apps/web`
- do not place Next.js routes or page files into shared packages
- treat `apps/web` as the Vercel root directory, not as the entire repository

## React and Next.js Style

- use server-first patterns where practical
- keep page files focused on composition
- move repeated UI blocks into components
- keep data fetching out of presentational leaf components
- avoid large page files with mixed query, mutation, and rendering logic
- prefer simple props over implicit context unless context is clearly justified

## Frontend Surface Style

- keep backend data shaping and frontend presentation separate
- use server-side view-model builders for page-specific display contracts
- do not let page components read or reinterpret raw persistence records directly
- prefer one stable page view model per surface over repeated ad hoc field mapping in many components

Inbox-specific UI rules:

- treat Inbox as a reader-style surface, not a dashboard
- prefer dense rows over large stacked cards
- use a dedicated Inbox shell when the page needs a reading-oriented layout rather than reusing a generic dashboard shell
- make the primary hierarchy:
  - title
  - excerpt
  - source and topic metadata
  - date
- keep actions secondary and compact
- preserve high information density without horizontal overflow

Layout resilience rules:

- long content must not push the page outside the viewport
- list rows and metadata containers should be built to tolerate long URLs, source labels, and tags
- use truncation, line clamping, and bounded flex layouts intentionally
- desktop and mobile may differ in navigation structure, but should preserve the same row-first reading model

## Database and Data Access Style

- keep schema definitions in the db package
- prefer typed query helpers over repeated inline query logic
- keep persistence concerns separate from normalization and knowledge-processing logic
- do not bypass the shared Item model
- schema changes must be reflected in `docs/data-model.md`

## Configuration And Environment Variable Rules

- credentials, secrets, tokens, base URLs, and environment-dependent values belong in environment variables
- stable domain constants and fixed code-level defaults may live in code
- use uppercase snake case for environment variables
- keep environment variable naming explicit and predictable
- do not hardcode provider keys, webhook secrets, or database credentials in source files
- if a new runtime dependency requires configuration, document the required env variable clearly

Examples:

- `DATABASE_URL`
- `KNOWLEDGE_ENRICHMENT_PROVIDER`
- `KNOWLEDGE_ENRICHMENT_MODEL`
- `KNOWLEDGE_ENRICHMENT_PROMPT_VERSION`
- `KNOWLEDGE_ENRICHMENT_TEMPERATURE`
- `KNOWLEDGE_ENRICHMENT_MAX_OUTPUT_TOKENS`
- `KNOWLEDGE_ENRICHMENT_TIMEOUT_MS`
- `KNOWLEDGE_ENRICHMENT_RETRY_ATTEMPTS`
- `KNOWLEDGE_ENRICHMENT_RETRY_BACKOFF_MS`
- `KNOWLEDGE_ENRICHMENT_API_KEY`
- `REDIS_URL`
- `KNOWLEDGE_ENRICHMENT_BASE_URL`
- `APP_BASE_URL`

Configuration placement rules:

- secrets in env
- deployment-specific URLs in env
- prompt text in prompt or ai modules
- business defaults in code when they are stable and non-sensitive

## Processor Style

Knowledge processing should be single-purpose and layered.

- each processing step should have explicit input and output behavior
- knowledge processing must not deliver content externally
- knowledge processing must not embed source-specific fetching logic
- preserve the V1 fixed order:
  - `score`
  - `dedupe`
  - `summarize`
  - `classify`
  - `group`

## Connector Style

- each connector is responsible only for fetch and source-specific adaptation into capture records
- connectors should not summarize or classify
- connectors should not perform generic RawAsset to Item normalization
- connector-specific quirks should stay local to the connector

## Normalization Style

- normalization turns `RawAsset` into `Item`
- normalization owns extraction, metadata cleanup, OCR, and transcription hooks
- normalization must not score, summarize, or create Notes
- normalization should produce a shared Item shape for downstream knowledge processing

## Knowledge Style

- knowledge logic owns scoring, dedupe, summarization, grouping, enrichment, and note creation
- knowledge sink sync belongs with knowledge logic, not lightweight delivery
- Notes should only be built from processed Items or explicit preservation actions

## Delivery Style

- delivery adapters should handle lightweight outbound delivery only
- delivery adapters should accept a review-ready payload such as a `Digest` or delivery-oriented projection
- adapters should format only for their own destination
- adapters must record success or failure through delivery logging
- delivery logic should not contain knowledge-processing logic or note-building logic

## Comments

- write comments only when the code would otherwise be hard to understand
- prefer comments that explain intent, constraints, or tradeoffs
- do not add comments that restate obvious code

## Error Handling Rules

- do not silently swallow errors
- errors should be surfaced at the correct boundary
- use explicit error messages that preserve debugging value
- prefer predictable error handling patterns within the same module

Recommended patterns:

- connectors may throw structured errors upward to the job or service boundary
- normalization and knowledge processing should fail clearly and preserve the Item context where possible
- delivery adapters should return a clear success or failure result and enough detail for logging
- UI should present user-friendly messages without exposing noisy internal detail

Error handling boundaries:

- connectors handle source-specific failure details, but do not decide UI behavior
- jobs record failure status and diagnostics
- server actions translate internal failures into user-safe responses
- delivery failures must still produce a DeliveryLog entry when applicable

When possible, include identifying context in errors:

- `source_id`
- `item_id`
- `digest_id`
- `destination_id`
- job type

## Logging Rules

- log key workflow transitions, not every minor internal step
- logs should help answer what happened, where it happened, and what object was affected
- use consistent field names in structured logs when possible

Minimum important log points:

- source sync started
- source sync succeeded
- source sync failed
- normalization started
- normalization succeeded
- normalization failed
- item processing started
- item processing succeeded
- item processing failed
- knowledge sync started
- knowledge sync succeeded
- knowledge sync failed
- digest generation started
- digest generation succeeded
- digest generation failed
- delivery started
- delivery succeeded
- delivery failed

Failure boundaries:

- `source sync failed` is reserved for fetch or capture-persistence failures
- downstream normalization or item-processing failures must keep their own object state and logs instead of rewriting source-sync state as a capture failure

Recommended log context fields:

- `job_type`
- `source_id`
- `capture_entry_id`
- `raw_asset_id`
- `item_id`
- `note_id`
- `digest_id`
- `destination_id`
- `status`
- `message`

Logging rules by layer:

- connectors log source-specific sync context
- processors log processing failures and major transitions
- delivery logs should complement, not replace, application logs
- UI components should avoid noisy console logging

## Formatting

- keep lines reasonably short
- prefer flat and readable control flow
- group related logic together
- keep import ordering consistent within a file
- do not use decorative patterns or unnecessary abstractions

## Testing and Validation

- validate each change at the smallest practical level
- prefer focused tests around new behavior
- for workflow changes, verify the end-to-end path affected by the change
- if something cannot be validated, state that explicitly in the final summary

## Validation Rules

The minimum validation depends on the kind of change.

### UI Changes

Validate:

- the affected page renders
- the changed interaction path works
- the change does not break the intended page structure

### API Changes

Validate:

- the route responds correctly
- the main success path works
- the returned shape is compatible with the calling UI or job

### Schema Changes

Validate:

- migrations can run
- the changed tables and constraints behave as intended

### Processing Changes

Validate:

- the changed processor works on at least one realistic Item
- the Item state after processing is correct
- downstream paths still work if affected

### Normalization Changes

Validate:

- the changed normalization step works on at least one realistic RawAsset
- RawAsset metadata and text are transformed into the expected Item shape
- downstream knowledge processing still works if affected

### Knowledge Changes

Validate:

- the changed knowledge step works on at least one realistic Item
- Note creation or enrichment output is correct if affected
- downstream review or sink sync paths still work if affected

### Delivery Changes

Validate:

- the adapter receives the correct shape
- success or failure is recorded clearly
- destination-specific formatting still works

### Documentation Changes

Validate:

- the updated doc matches current behavior or intended approved behavior
- related docs are not left inconsistent

## Git Commit Message Format

Use this format:

`<type>(<scope>): <summary>`

Examples:

- `feat(sources): add RSS source creation flow`
- `feat(inbox): render processed item cards`
- `fix(processors): prevent duplicate item grouping`
- `docs(project): clarify MVP source types`
- `refactor(delivery): split notion adapter formatting`
- `chore(repo): add pnpm workspace config`

## Allowed Commit Types

- `feat`
- `fix`
- `docs`
- `refactor`
- `test`
- `chore`

## Commit Timing And Granularity

Commits should be made when a change reaches a stable and explainable checkpoint.

Do not treat commits as arbitrary save points.

A commit should usually represent one of the following:

- one completed and validated feature slice
- one completed bug fix
- one completed refactor with preserved behavior
- one stable documentation decision

Preferred rule:

`one commit = one coherent change that can be explained, reviewed, and validated`

## When To Commit

Commit when:

- a task has reached a usable or verifiable state
- a Linear issue or subtask has reached a clear checkpoint
- a documentation change establishes an important stable decision
- a code change and its required doc change are both complete

Examples of good commit moments:

- database schema for a new domain object is complete
- RSS source creation flow is implemented and checked
- RSS sync path is implemented and verified
- Inbox processed item list is rendered and working
- architecture docs are updated to reflect a new stable decision

## When Not To Commit

Do not commit when:

- the work is half-finished and not understandable on its own
- multiple unrelated changes are mixed together
- validation has not been performed for behavior-changing work
- code and docs are temporarily inconsistent
- the commit only contains temporary debug changes

## Commit Scope Rules

- one commit should focus on one coherent concern
- do not mix unrelated issues in one commit
- do not combine broad docs cleanup with unrelated feature work
- if a behavior change requires docs to stay correct, include the doc change in the same commit or in a clearly preceding docs commit

## Commit Strategy By Work Type

### For Feature Work

Prefer commits that map to a user-visible or system-verifiable result.

Examples:

- `feat(db): add sources and items schema`
- `feat(sources): add RSS source creation API`
- `feat(connectors): implement RSS sync flow`
- `feat(inbox): render processed item list`

### For Documentation Work

Commit once the documentation reflects a stable decision, not while it is still exploratory.

Example:

- `docs(architecture): define job contracts for async flows`

### For Refactors

Only commit when the refactor forms a complete boundary-preserving change.

Example:

- `refactor(delivery): split destination formatting from send logic`

## Validation Before Commit

Before committing behavior-changing work, do the smallest practical validation.

Examples:

- run affected tests
- run type checking if relevant
- verify the changed page or API path
- verify the changed workflow path end to end when practical

If validation cannot be completed, note that clearly in the final summary or follow-up documentation.

## Commit Message Rules

- use Conventional Commits
- format commit subjects as `type(scope): summary`
- do not omit the `type`
- do not omit the `scope` for implementation work unless the change is truly repository-wide
- use imperative mood
- keep the summary concise
- make the scope specific when possible
- one commit should represent one coherent change
- do not mix unrelated work into the same commit
- if a change updates docs because behavior changed, prefer including doc updates in the same commit
- if a commit in the current PR introduces a regression, repair it before treating the PR as review-ready again
- do not let a PR turn into a chain where each commit only repairs the immediately previous commit's avoidable breakage
- when review finds a regression introduced by the current PR, the expected outcome is a coherent repaired PR state, not a growing stack of self-inflicted follow-up fixes

Examples:

- `feat(inbox): render processed items from knowledge output`
- `fix(knowledge): keep processing failures out of source sync state`
- `docs(workflow): require preview path validation`
- `refactor(capture): isolate source sync persistence`
- `test(db): add topic group concurrency coverage`
- `chore(repo): align pnpm workspace scripts`

## Suggested Scopes

- `repo`
- `web`
- `home`
- `inbox`
- `digest`
- `sources`
- `destinations`
- `settings`
- `db`
- `connectors`
- `processors`
- `delivery`
- `jobs`
- `docs`
- `project`

## Branch Naming

Prefer:

- `main` for the default branch
- `codex/<short-topic>` for feature branches when a separate branch is needed

Examples:

- `codex/rss-ingest`
- `codex/inbox-page`
- `codex/digest-generator`

## Branch Rules

- use `main` as the stable integration branch
- use a feature branch for non-trivial implementation work
- use a feature branch for schema changes
- use a feature branch for new source, processor, or destination work
- small doc-only clarifications may be done without a feature branch when appropriate

When in doubt, create a branch.

## Documentation Update Rules

Update docs when behavior, structure, or core concepts change.

Use these rules:

- update `docs/project.md` when product behavior, page roles, or MVP boundaries change
- update `docs/architecture.md` when module boundaries, runtime flow, job contracts, or extension rules change
- update `docs/data-model.md` when schema, state flow, or core domain naming changes
- update `docs/progress.md` when phase goals, current priorities, or execution order changes
- update `docs/development-style.md` when development conventions change

Do not leave code and docs knowingly inconsistent after a stable change.

## Change Discipline

Before implementing non-trivial work:

1. check the docs
2. confirm whether the change affects product, architecture, or data model
3. update docs first if required
4. implement the code change
5. validate the affected path
6. commit once the change reaches a stable checkpoint

## Definition Of Done For A Change

A change should usually be considered done only when:

- the implementation is complete for the intended scope
- the affected path has been validated at a practical level
- related docs are updated if required
- naming and module boundaries remain consistent
- the change can be explained as one coherent result

## Review Heuristics

A change is good if it:

- matches existing naming and boundaries
- keeps modules focused
- is easy to read
- is easy to validate
- does not make the default user experience more complex
