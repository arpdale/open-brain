# WORKFLOW

This document defines the required workflow for making changes to the Open Brain codebase.

All contributors (human or AI) must follow this workflow for **Mode 1 work** (committed code: extensions, primitives, recipes, schemas, dashboards, integrations, skills, governance docs, CI workflows). It does **not** apply to Mode 2 local scratch in `.planning/` (gitignored, personal experimentation), as defined in `GOVERNANCE.md`.

---

## Default Role

- The default executing role is **Product Architect**
- Review roles (defined in `ROLES.md`) must be explicitly invoked

---

## Required Workflow Steps

### 0. Discovery Gate

Before planning any non-trivial change, contributors must determine whether discovery is required.

Discovery requirements and outputs are defined in `DISCOVERY.md`.

If discovery is required, a Discovery Summary must be produced before proceeding to planning.

---

### 0.5. Approach (Optional but Recommended)

For non-trivial changes, an Approach phase may be used between Discovery and Planning to evaluate multiple solution paths and tradeoffs before converging on a plan.

See `APPROACH.md`.

---

### 1. Plan First
Before writing code:
- Confirm the Discovery Gate is satisfied (if applicable)
- Propose an implementation plan
- Identify risks and mitigations
- Define a rollback plan

No code should be written before this step unless explicitly approved.

---

### 2. Implement in Small Steps
- Keep changes small and scoped
- Prefer multiple small commits over large ones
- Avoid scope creep

---

### 3. Self-Review Using Roles
Before marking work as complete:
- Switch to **Security Reviewer** and review (per `ROLES.md`)
- Switch to **Regression Reviewer** and review (per `ROLES.md`)
- Apply all blocking feedback

Additional reviewers (Performance & Scale, DX & Maintainability) should be used for risky changes.

---

### 4. Provide a Completion Summary
All completed work must include:
- Summary of what changed
- Files changed
- Risks and how they were mitigated
- Manual verification steps
- Tests run (or why none)
- Rollback steps

Work is not considered complete without this summary.

---

## Mode 2 Carve-Out (`.planning/`)

Work performed inside `.planning/` is exempt from the heavy workflow above. `.planning/` is gitignored, used for local brownfield planning, ingestion scripts, and maintainer experimentation. The Discovery / Approach / Plan / Review / Summary phases are not required there.

When a `.planning/` artifact is promoted to a public contribution (e.g., moved into `dashboards/`, `recipes/`, `extensions/`), it enters Mode 1 and the full workflow applies from the point of promotion.

---

## Permission Handling for AI Contributors

To allow focused, autonomous execution and minimize interruption, AI contributors (e.g. Claude Code, Cursor, Codex) must follow the permission rules below.

### Operating Mode: Batched Permissions

AI contributors **must not** ask for step-by-step permission.

Instead, they operate within a **pre-approved scope** defined at the start of each task.

---

### Pre-Approved Actions (Within Scope)

Unless explicitly restricted in the task, AI contributors are pre-approved to:

- Edit only the files explicitly listed in the task
- Create small supporting files (types, helpers, documentation) required to complete the task
- Refactor code only where necessary to complete the task
- Run only the commands explicitly listed in the task

No permission is required for the above actions.

---

### Not Pre-Approved Actions

AI contributors must **pause and request permission** before:

- Editing files outside the approved list
- Running commands not explicitly approved
- Rotating, deleting, or adding secrets
- Deploying Edge Functions or running database migrations against any environment
- Sending real emails, notifications, or messages to real users
- Making irreversible or destructive changes (e.g., `git push --force`, schema-breaking migrations)

---

### Permission Gates (When to Interrupt)

AI contributors may interrupt **only** at these gates:

1. Before any deploy, secret change, or irreversible action
2. When work must proceed outside the approved scope

Permission requests must be **batched into a single message**.

---

### Required Format for Permission Requests

When permission is required, the request must include:

- Actions requested (explicit list)
- Reason each action is necessary
- Risk level (low / medium / high)
- Rollback plan

Multiple step-by-step permission requests are not allowed.

---

## Communication Rules

- Do not ask questions unless blocked
- Do not interrupt repeatedly for confirmation
- Call out uncertainty explicitly
- Do not assume previous sessions are still relevant
- Treat repo markdown files as authoritative

---

## Definition of Done

Work is considered done only when:
- All required reviews are complete
- Verification steps are provided
- Rollback is safe and obvious
- Constraints have not been violated
