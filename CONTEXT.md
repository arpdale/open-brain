# CONTEXT

This document provides structural orientation for the Open Brain repository.

It is **evergreen and non-authoritative**.
It explains *what exists* and *where to look*, not rules, setup steps, or implementation details.

For governance, constraints, and enforcement, see `GOVERNANCE.md`.

---

## What Is Open Brain?

Open Brain is a persistent AI memory system: **one database (Supabase + pgvector), one MCP protocol, any AI client.** A user's brain travels across Claude Desktop, Cursor, Codex, ChatGPT, mobile clients, and future agents — they all read and write the same `thoughts` table.

This repository contains the **community contribution layer**: extensions, primitives, recipes, schemas, dashboards, integrations, and skills that users install on top of their personal Open Brain instance.

Key shape that defines the repo:
- License is FSL-1.1-MIT — no commercial derivative works
- Contribution clarity is the product; READMEs must be copy-paste-ready and beginner-readable
- The core `thoughts` table is a public contract; contributions extend it via additional columns or jsonb metadata, never by altering existing columns
- MCP servers introduced by contributions must be remote (Supabase Edge Functions), not local

---

## System Landscape (Ownership Map)

The Open Brain ecosystem has two layers. This repo lives in layer 1.

### Layer 1: This repository (community contribution layer)
- **Contribution categories** → top-level folders (`extensions/`, `primitives/`, `recipes/`, `schemas/`, `dashboards/`, `integrations/`, `skills/`)
- **Governance & rules** → root markdown files (`GOVERNANCE.md`, `CONSTRAINTS.md`, `SECURITY.md`, `ROLES.md`, `WORKFLOW.md`, `CONTRIBUTING.md`)
- **Architecture intent** → `ARCHITECTURE.md`
- **Operational docs** → `docs/` (getting started, companion prompts, FAQ, MCP tool audit)
- **CI tooling** → `.github/workflows/` (automated review gates)
- **Templates** → `_template/` folders within each category, plus `.github/PULL_REQUEST_TEMPLATE.md` and `.github/metadata.schema.json`
- **Maintainer scratch** → `.planning/` (gitignored; out of scope for public contribution rules)

### Layer 2: User's upstream instance (not in this repo)
- **Supabase project** → Postgres + pgvector + Edge Functions, holds the `thoughts` table
- **MCP servers** → deployed as Edge Functions, connect to AI clients via custom-connector URLs
- **AI clients** → Claude Desktop, Cursor, Codex, etc. — each user chooses which to connect
- **Dashboards** → optional, hosted on Vercel/Netlify/etc., point at the user's Supabase project

This repo's job is to make Layer 2 buildable. It does not run Layer 2.

---

## Trust Model (Mental Model)

At a high level:

- Contribution PRs are untrusted until automated CI gates pass and a human reviewer approves
- Maintainers own the merge bar
- Users own their upstream instances; this repo teaches safe defaults but does not enforce them post-install
- Within an upstream instance, secrets live in environment variables only; service-role keys never reach the client
- Remote MCP (Edge Functions) is the only sanctioned MCP transport for contributions

Dangerous assumptions to avoid:
- "A contribution that's been merged is safe to install without reading the README"
- "Secrets in `.env.example` are fine because they look fake"
- "Local MCP via `claude_desktop_config.json` is acceptable for a contribution"
- "I can modify the core `thoughts` table structure as long as my contribution needs it"
- "An AI agent's summary of what it changed is sufficient verification"

Correct mental model:
- Contributions are self-contained subfolders with README + metadata + code
- Public contribution rules apply to everything outside `.planning/`
- Edge Functions are the only safe place for secret-backed integrations
- The `thoughts` table is a contract; extend it, do not alter it

---

## Where Things Live (Repo Map)

- **Governance & rules** → Root (`GOVERNANCE.md`, `CONSTRAINTS.md`, `SECURITY.md`, `ROLES.md`, `WORKFLOW.md`, `CONTRIBUTING.md`)
- **Workflow phases** → Root (`DISCOVERY.md`, `APPROACH.md`)
- **Architecture intent & boundaries** → Root (`ARCHITECTURE.md`)
- **Agent instructions** → Root (`CLAUDE.md`, `AGENTS.md` when present)
- **Operational how-tos** → `docs/`
- **Contribution metadata schema** → `.github/metadata.schema.json`
- **PR template** → `.github/PULL_REQUEST_TEMPLATE.md`
- **Automated review** → `.github/workflows/ob1-*.yml`
- **Templates per category** → `_template/` inside each contribution folder
- **Maintainer scratch (gitignored)** → `.planning/`
- **External (not in repo)** → Discord (community), GitHub Discussions, individual users' Supabase projects

---

## Codebase Orientation (High Level)

This repo is documentation- and contribution-folder-heavy, not application-heavy. There is no SPA, no backend service, no runtime.

- **Top-level governance docs** → root `*.md` files
- **Contribution folders** → `extensions/`, `primitives/`, `recipes/`, `schemas/`, `dashboards/`, `integrations/`, `skills/`
- **Each contribution** → its own subfolder with `README.md`, `metadata.json`, and code/SQL/templates
- **Operational docs** → `docs/`
- **CI workflows** → `.github/workflows/`
- **Resources & assets** → `resources/`
- **Maintainer scratch** → `.planning/` (gitignored)

---

## Non-Obvious Gotchas

These are structural and recurring — not time-based:

- The core `thoughts` table is `(id, content, embedding vector(1536), metadata jsonb, created_at, updated_at)`. Adding columns via a contribution schema is fine; altering or dropping existing columns is rejected by CI.
- `metadata` is the access surface for filtering and source-specific data. Use namespaced keys (`<source>_*`) to avoid collisions across capture sources.
- Embeddings are 1536-dim. Contributions that introduce different embedding sizes must justify the choice and provide migration guidance.
- MCP transport must be remote. Contributions referencing `claude_desktop_config.json` or `StdioServerTransport` are rejected.
- `esm.sh` imports in Edge Functions must pin exact versions. `@2` is rejected; `@2.39.3` is accepted.
- `.planning/` is gitignored intentionally. CI does not check it; it is not part of the public contribution contract.
- The automated review checks scope: changes outside the contribution folder require maintainer alignment first.

Keep this list short and prune aggressively.

---

## What This Document Is NOT

This document is **not**:
- Governance or policy (see `GOVERNANCE.md`, `SECURITY.md`)
- A setup or installation guide (see `docs/01-getting-started.md`)
- A feature inventory
- An API reference
- A roadmap or planning document
- A session log or handoff note

If information changes because **time passes**, it does not belong here.

---

## Purpose Recap

This file exists to:
- Orient humans and AI agents quickly
- Provide a system map and mental model
- Point to authoritative sources

It should remain stable over time.
