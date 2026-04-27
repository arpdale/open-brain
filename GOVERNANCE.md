# GOVERNANCE

This document is the **authoritative entry point** for all work on the Open Brain codebase.

It applies to:
- Human contributors
- AI coding agents (e.g. Claude Code, Cursor, Codex, future agents)
- Any automated system that reads, writes, or modifies repository files

No code, architecture, or workflow decisions should be made without first aligning to this governance model.

---

## Purpose

This document exists to:

- Establish a single source of truth for how work is governed
- Ensure humans and AI agents follow the same operating rules
- Eliminate the need to re-explain workflow and constraints
- Provide a predictable, auditable development lifecycle

This file does **not** restate detailed rules.
It defines **how to navigate and apply** the other governance documents.

---

## Two Contribution Modes

Open Brain has two distinct working modes. The governance below applies primarily to **Mode 1**.

**Mode 1 — Public contribution (committed code).**
Adding extensions, primitives, recipes, schemas, dashboards, integrations, skills, or modifying repo governance, docs, or CI workflows. These changes are reviewed via PR and must pass the automated CI gates in `.github/workflows/`. The full workflow in `WORKFLOW.md` applies.

**Mode 2 — Local scratch (`.planning/`).**
A maintainer's local execution layer for brownfield planning, ingestion scripts, and personal experiments. `.planning/` is gitignored and is **out of scope** for the heavy WORKFLOW phases. Public contribution rules do not apply here. When a `.planning/` artifact is ready to promote to a public contribution, it enters Mode 1 and the full workflow applies from the point of promotion.

---

## Governance Model (How This Repo Is Structured)

Open Brain governance is layered:

1. **GOVERNANCE.md**
   → Entry point and authority model

2. **Non-Negotiable Rules**
   → `CONSTRAINTS.md`
   → `SECURITY.md`

3. **Roles & Decision Authority**
   → `ROLES.md`

4. **Execution & Process**
   → `WORKFLOW.md`
   → `DISCOVERY.md`
   → `APPROACH.md`
   → `CONTRIBUTING.md` (public contribution standards)

5. **Agent-Specific Instructions**
   → `CLAUDE.md`
   → `AGENTS.md` (when present)
   → Claude Code auto-loads `CLAUDE.md`; it must contain only agent startup and behavior instructions.

6. **Operational Documentation**
   → `docs/` (setup guides, companion prompts, FAQ, MCP tool audit)
   → Non-authoritative on policy.

7. **Codebase Orientation**
   → `CONTEXT.md`
   → `ARCHITECTURE.md`
   → Structural overview, system map, and mental model (evergreen, non-authoritative).

All contributors are expected to route themselves correctly through these documents.

---

## Required Reading by Situation

Before starting work, identify what kind of task you are performing and review the corresponding documents.

### Required for **all Mode 1 work**
- `CONSTRAINTS.md`
- `SECURITY.md`

### New to the codebase (recommended)
- `CONTEXT.md`
- `ARCHITECTURE.md`

### Designing or modifying system structure
- `ARCHITECTURE.md`

### Writing or changing committed code
- `WORKFLOW.md`
- `CONTRIBUTING.md`

### Acting as an AI agent
- `CLAUDE.md`

Failure to consult the relevant documents is considered a governance violation.

---

## Session Start Contract (MANDATORY for Mode 1)

At the start of every working session that touches committed code:

1. Identify the task you are working on
2. Determine which governance documents apply
3. Confirm no constraints are being violated
4. Call out uncertainty before proceeding
5. Do not make assumptions to move faster

If required information is missing or unclear:
- **Pause**
- **Ask**
- **Do not guess**

---

## Behavioral Expectations

For non-trivial work, contributors should avoid proposing a single plan without either:

- Explicitly justifying why alternatives are not meaningful, or
- Presenting multiple approaches and tradeoffs

This expectation exists to prevent premature convergence on solutions.

See `APPROACH.md` for guidance on evaluating options before planning.

---

## Authority & Conflict Resolution

If guidance conflicts:

1. `SECURITY.md` and `CONSTRAINTS.md` override all other documents
2. Role-based vetoes defined in `ROLES.md` apply
3. Architecture guidance (`ARCHITECTURE.md`) overrides workflow preferences
4. This document defines how conflicts are resolved

When in doubt, stop and escalate.

---

## Enforcement

These governance rules are not advisory.

Violations include:
- Bypassing workflow rules in Mode 1 work
- Ignoring security requirements
- Making architectural changes without alignment
- AI agents proceeding under uncertainty
- Skipping required reviews or summaries

Governance violations are treated as bugs.

---

## Single Entry Point Rule

When referencing "how work is done on Open Brain":
- Reference **this file only**
- Do not list or restate other markdown files
- Let this document route contributors correctly

If you are unsure where to start:
→ Start here.
