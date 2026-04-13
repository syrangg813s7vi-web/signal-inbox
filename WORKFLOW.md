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
6. For work that changes or adds a runnable web path, do not move to `In Review` until the site is available through a Vercel preview deployment and the handoff includes the concrete preview URL.
7. For web-facing work, do not treat green typecheck, build, or deployment checks as sufficient proof of correctness on their own. Validate the affected preview route directly before review handoff.
8. Do not treat local changes alone as review-ready. The expected review handoff is:
   - branch created
   - focused commit created
   - branch pushed
   - PR prepared or opened for human review
9. If the branch is ready for review and GitHub CLI is available, create a PR instead of stopping at branch push alone.
10. Prefer creating a draft PR unless the issue explicitly says the work is ready for a non-draft review handoff.
11. Treat "branch pushed but no PR created" as an incomplete handoff, not as success.
12. Include the PR URL in the final handoff summary whenever a PR is created.
13. If `gh` is authenticated, explicitly run `gh pr create` for the issue branch instead of assuming another system will open the PR later.
14. If PR creation fails, report the command failure clearly, keep the issue out of review-ready state, and explain the blocker in the final handoff.
15. Do not mark work as `Done` from the agent workflow. `Done` is reserved for human-reviewed and accepted work.
16. If the issue is blocked, explain the blocker clearly and leave the work classified as blocked instead of pretending it is complete.
17. For implementation issues, work on a dedicated branch named `codex/<issue-identifier>` instead of committing directly to `main`.
18. Keep changes incremental and aligned with current repository terminology.
19. Validate the affected path before stopping.
20. If the acceptance criteria are met, stage the intended files and create a focused git commit.
21. Use Conventional Commits for every commit, in the form `type(scope): summary`.
22. For implementation work, include a specific scope in the commit subject instead of using an unscoped summary.
23. Do not use generic imperative-only commit subjects such as `Fix ...` or `Add ...` without the required Conventional Commit prefix.
24. Push the branch and prepare the work for human review instead of treating a local commit as the final handoff.
25. Do not leave completed work only as uncommitted workspace changes unless you are blocked.
26. If you do not commit or cannot prepare the branch for review, explain exactly why the task is not ready to hand off.
27. If a PR already exists for the issue branch, explicitly gather and review PR feedback before moving the issue to `In Review`.
28. The required PR feedback sweep includes:
   - top-level PR comments
   - review summaries and requested-changes states
   - inline review comments
   - issue-owner or reviewer comments that describe a blocker, even if they are not formal GitHub review objects
29. Treat actionable PR feedback as blocking until one of these is true:
   - code, tests, or docs were updated to address it
   - an explicit, justified pushback response was posted on the PR thread
30. Do not ignore a PR comment just because it was posted as a top-level issue comment instead of a structured review. If the comment contains a concrete defect report, failed validation result, blocker, or required follow-up, treat it as actionable feedback.
31. When a PR exists, the agent must read the current PR comment stream again after each significant push and before any transition to `In Review`.
32. Do not leave actionable PR comments unresolved while classifying the issue as review-ready.
33. Summarize:
   - what changed
   - what docs changed
   - how the work was validated
   - whether the Vercel preview deployment is available
   - the Vercel preview URL used for review, if applicable
   - whether the work was committed
   - whether the branch is ready for PR / human review
   - whether a PR was created
   - the PR URL if available
   - what Linear state the issue should move to next
   - any blockers or follow-up risks

## PR Feedback Sweep Protocol

When an issue branch already has a PR, run this protocol before treating the work as review-ready:

1. Identify the PR for the current branch.
2. Gather feedback from all PR channels:
   - top-level PR comments
   - review summaries and requested-changes states
   - inline review comments
   - issue-owner or reviewer comments that describe a blocker, failed validation result, defect, or required follow-up
3. Treat every actionable PR comment as blocking until one of these is true:
   - code, tests, docs, or validation were updated to address it
   - an explicit, justified pushback reply was posted on the PR thread
4. Do not treat "no formal review objects" as equivalent to "no review feedback" when top-level PR comments contain blockers or required validation gaps.
5. After each significant push on a PR branch, re-read the PR comment stream before deciding the issue is ready for `In Review`.
6. Before any transition to `In Review`, confirm there are no outstanding actionable PR comments.
7. If actionable PR comments remain, keep the issue in `In Progress` and continue the implementation or validation loop.

## Project-Specific Constraints

- Keep Home minimal and result-first.
- Keep Inbox as the primary work surface.
- Treat the product as a three-domain system:
  - `Capture`
  - `Knowledge`
  - `Review`
- Keep implementation aligned with four stable layers:
  - `Capture Layer`
  - `Normalization Layer`
  - `Knowledge Layer`
  - `Review Layer`
- All inputs must enter through shared capture and normalization paths.
- Keep the V1 fixed processing order:
  - `score`
  - `dedupe`
  - `summarize`
  - `classify`
  - `group`
- Treat `Note` creation and knowledge sink sync as part of the Knowledge Layer, not generic delivery.
- Treat review generation and reminder selection as part of the Review Layer.
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
- For web-facing changes, `In Review` also requires a Vercel preview deployment URL included in the handoff.
- For web-facing changes, `In Review` also requires direct preview validation of the affected route or feature, not only passing checks.
- If the issue branch already has a PR, `In Review` also requires that all actionable PR feedback has been addressed or explicitly answered with justified pushback.
- Do not treat "no formal review objects" as equivalent to "no review feedback" when top-level PR comments contain blockers or required validation gaps.
- Minimum direct preview validation means:
  - the affected preview route loads successfully
  - the route does not fail with runtime or server-render errors
  - the issue's primary user action path works in the preview environment
- The handoff must state exactly which preview route and which user action path were validated.
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
