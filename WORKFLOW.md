---
tracker:
  kind: linear
  project_slug: "cdd793b8a803"
  active_states:
    - In Progress
    - In Review
  terminal_states:
    - Done
    - Canceled
    - Duplicate

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
  thread_sandbox: danger-full-access
  turn_sandbox_policy:
    type: dangerFullAccess
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
3. Treat Linear state transitions as part of the handoff, not as optional metadata.
4. Use `In Progress` only while the issue is actively being implemented or validated in a workspace.
5. Move work to `In Review` only when the acceptance criteria are met and the branch is ready for human review.
6. Do not treat local changes alone as review-ready. The expected review handoff is:
   - branch created
   - focused commit created
   - branch pushed
   - PR prepared or opened for human review
7. If the branch is ready for review and GitHub CLI is available, create a PR instead of stopping at branch push alone.
8. Prefer creating a draft PR unless the issue explicitly says the work is ready for a non-draft review handoff.
9. Treat "branch pushed but no PR created" as an incomplete handoff, not as success.
10. Include the PR URL in the final handoff summary whenever a PR is created.
11. If `gh` is authenticated, explicitly run `gh pr create` for the issue branch instead of assuming another system will open the PR later.
12. If PR creation fails, report the command failure clearly, keep the issue out of review-ready state, and explain the blocker in the final handoff.
13. Do not mark work as `Done` from the agent workflow. `Done` is reserved for human-reviewed and accepted work.
14. If the issue is blocked, explain the blocker clearly and leave the work classified as blocked instead of pretending it is complete.
15. For implementation issues, work on a dedicated branch named `codex/<issue-identifier>` instead of committing directly to `main`.
16. Keep changes incremental and aligned with current repository terminology.
17. Validate the affected path before stopping.
18. If the acceptance criteria are met, stage the intended files and create a focused git commit.
19. Push the branch and prepare the work for human review instead of treating a local commit as the final handoff.
20. Do not leave completed work only as uncommitted workspace changes unless you are blocked.
21. If you do not commit or cannot prepare the branch for review, explain exactly why the task is not ready to hand off.
22. Summarize:
   - what changed
   - what docs changed
   - how the work was validated
   - whether the work was committed
   - whether the branch is ready for PR / human review
   - whether a PR was created
   - the PR URL if available
   - what Linear state the issue should move to next
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
- Normal implementation handoff is:
  - branch
  - commit
  - push
  - PR
  - human review
- Use a draft PR by default for implementation handoff unless the task explicitly calls for a ready PR.
- A branch without a PR is not a complete human-review handoff.
- If `gh auth status` succeeds, the agent is expected to create the PR directly.
- If `gh pr create` fails, the agent must report that failure and keep the issue out of `In Review`.
- Recommended Linear flow is:
  - `In Progress`
  - `In Review`
  - `Done`
- Use `In Review` only for work that is already ready for human inspection and has a reviewable PR URL.
- Leave blocked work in a non-terminal blocked state instead of moving it forward prematurely.
- Direct commits to `main` should be reserved for explicitly requested repository maintenance or documentation-only exceptions.
- Before stopping, classify the issue as exactly one of:
  - `blocked`
  - `still in progress`
  - `ready for review`

{% if issue.labels contains "bug" %}
## Bug Handling

Reproduce the issue first.
Preserve current behavior outside the bug scope.
{% elsif issue.labels contains "feature" %}
## Feature Handling

Begin by checking whether docs must change before code.
Keep the implementation aligned with the existing architecture.
{% endif %}
