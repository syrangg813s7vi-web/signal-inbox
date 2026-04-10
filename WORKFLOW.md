---
tracker:
  kind: linear
  project_slug: "replace-with-linear-project-slug"
  active_states:
    - Ready for Build
    - In Build
    - Rework
  terminal_states:
    - Done
    - Closed
    - Cancelled

polling:
  interval_ms: 5000

workspace:
  root: ~/code/symphony-workspaces

hooks:
  after_create: |
    git clone --depth 1 git@github.com:syrangg813s7vi-web/signal-inbox.git .

agent:
  max_concurrent_agents: 4
  max_turns: 24

codex:
  command: codex app-server
  approval_policy: never
  thread_sandbox: workspace-write
---

{% if attempt %}
## Continuation (Attempt #{{ attempt }})

Resume from the current workspace state.
Do not restart from scratch.
{% else %}
## Initial Run

Start with investigation and align the work against the repository docs before making changes.
{% endif %}

You are working on Linear issue `{{ issue.identifier }}`.

**Title**: {{ issue.title }}

**Description**:
{% if issue.description %}
{{ issue.description }}
{% else %}
No description provided.
{% endif %}

**State**: {{ issue.state }}

**URL**: {{ issue.url }}

{% if issue.labels %}
**Labels**: {{ issue.labels | join: ", " }}
{% endif %}

{% if issue.blocked_by %}
## Blockers

Do not proceed if blockers are unresolved.
{% for blocker in issue.blocked_by %}
- {{ blocker.identifier }} ({{ blocker.state }})
{% endfor %}
{% endif %}

## Repository Rules

Read these files before substantial work:

- `README.md`
- `docs/project.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/progress.md`
- `docs/development-style.md`
- `docs/symphony-setup.md`
- `docs/issue-definition.md`

Follow the repository conventions in `docs/development-style.md`.

## Required Workflow

1. Understand the issue and affected docs or modules.
2. If the issue changes product behavior, architecture, data model, or execution plan, update docs first.
3. Keep changes incremental and aligned with current repository terminology.
4. Validate the affected path before stopping.
5. Summarize:
   - what changed
   - what docs changed
   - how the work was validated
   - any blockers or follow-up risks

## Project-Specific Constraints

- Keep Home minimal and result-first.
- Keep Inbox as the primary work surface.
- Keep the V1 fixed processing order:
  - `dedupe`
  - `summarize`
  - `classify`
  - `group`
- Do not bypass the shared `Item` model.
- Do not mix connector logic, processor logic, delivery logic, and UI logic in the same place.

{% if issue.labels contains "bug" %}
## Bug Handling

Reproduce the issue first.
Preserve current behavior outside the bug scope.
{% elsif issue.labels contains "feature" %}
## Feature Handling

Begin by checking whether docs must change before code.
Keep the implementation aligned with the existing architecture.
{% endif %}
