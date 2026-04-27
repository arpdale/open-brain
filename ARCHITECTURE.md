# ARCHITECTURE

This document defines the system architecture, boundaries, and key decisions for Open Brain.

It is **authoritative** for architectural questions. All contributors (human and AI) must align to it.

This document explains **what the system is and why**, not how to build or configure it.
For implementation details and step-by-step setup, see `docs/01-getting-started.md` and the `_template/` folder in each contribution category.

---

## System Overview

Open Brain is a persistent AI memory system: one database (Supabase + pgvector), one MCP protocol, any AI client.

There are two layers to think about:

1. **Upstream personal instance** — what each user builds for themselves: a Supabase project with a `thoughts` table (content + 1536-dim embeddings + jsonb metadata), one or more remote MCP servers deployed as Edge Functions, and any dashboards or integrations they choose to add. This layer is owned by the user and does not live in this repo.

2. **This repo (community contribution layer)** — extensions, primitives, recipes, schemas, dashboards, integrations, and skills that users install on top of their personal instance. Plus the docs and CI tooling that govern how those contributions are reviewed and merged.

The architecture below defines boundaries within the contribution repo and the contract between the repo and the upstream instances it targets.

---

## System Boundaries

| Component | Owner | Responsibility |
|-----------|-------|----------------|
| **Contribution categories** (`extensions/`, `primitives/`, `recipes/`, `schemas/`, `dashboards/`, `integrations/`, `skills/`) | Contributors | Self-contained subfolders with `README.md`, `metadata.json`, and code |
| **Repo governance** (`GOVERNANCE.md`, `CONSTRAINTS.md`, `SECURITY.md`, `ROLES.md`, `WORKFLOW.md`, `CONTRIBUTING.md`) | Maintainers | Authoritative rules and review process |
| **Automated CI gates** (`.github/workflows/`) | Maintainers | Machine-readable rule enforcement on every PR |
| **Operational docs** (`docs/`) | Maintainers + community | Getting started, companion prompts, FAQ, MCP tool audit |
| **Upstream `thoughts` table** | User's Supabase project | Persistent storage; pgvector for similarity search; jsonb for metadata |
| **Upstream Edge Functions** | User's Supabase project | Remote MCP servers, REST gateways, capture endpoints — secret-backed integrations |
| **AI clients** (Claude Desktop, Cursor, Codex, etc.) | Third parties | Connect to user's MCP servers via custom-connector URLs |
| **Dashboards** | User's hosting (Vercel, Netlify, etc.) | Frontend templates pointed at user's Supabase backend |

**Boundary rule:** Each component owns its domain. Contributions must not modify core upstream contracts (the `thoughts` table structure) without maintainer alignment.

---

## Trust Model

| Layer | Trust Level | Notes |
|-------|-------------|-------|
| Contribution PRs | **Untrusted until reviewed** | Automated CI gates first, then human review |
| Repo maintainers | **Trusted** | Approve and merge contributions |
| User's upstream instance | **Owned by user** | Trust model is the user's responsibility; this repo's role is to teach safe defaults |
| AI clients connecting via MCP | **Authenticated** | Custom-connector URLs include access tokens; Edge Functions verify |
| Edge Function secrets | **Server-side only** | Service-role keys, OpenRouter keys, OAuth tokens never reach the client |
| External APIs (Gmail, Notion, etc.) | **Verify** | OAuth flows, webhook signature verification where applicable |

**Trust rules:**
- Never trust a contribution PR until it has passed automated checks and human review.
- Never trust client-side code in dashboards or browser extensions.
- Service-role keys and other secrets must live in environment variables only.
- MCP servers must be remote (Edge Functions); local-MCP patterns are prohibited.

---

## Key Architectural Decisions

### 1. Supabase + pgvector as the canonical backend
**Why:** Single managed service for Postgres, auth, vector search, and Edge Functions. Free-tier-friendly. pgvector handles 1536-dim embeddings without a separate vector database.

### 2. One canonical `thoughts` table
**Why:** Shared schema across all clients and integrations is what makes "any AI client can read your brain" possible. Adding metadata via `jsonb` extends the contract without breaking it.

### 3. Remote MCP via Edge Functions, not local stdio
**Why:** Local MCP (`claude_desktop_config.json`, `StdioServerTransport`) ties a user's brain to one machine and one client. Remote MCP via custom-connector URLs works across Claude Desktop, Cursor, Codex, mobile clients, and future agents.

### 4. Contribution-folder isolation
**Why:** Every contribution is self-contained in its own subfolder with a `README.md` and `metadata.json`. This makes contributions auditable, reviewable, and removable without affecting other contributions.

### 5. Two-mode governance (Mode 1 / Mode 2)
**Why:** Maintainers need a low-friction local scratch space (`.planning/`) for brownfield work. Public contributions need full governance and CI gates. Separating the two prevents the heavy workflow from blocking everyday experimentation.

### 6. Automated CI gates before human review
**Why:** Machine-readable rules (folder structure, metadata validity, no secrets, SQL safety, no binary blobs, link integrity) are checked first to keep human reviewer time focused on quality and clarity.

---

## Data Ownership

| Data Type | Storage | Access Control |
|-----------|---------|----------------|
| `thoughts` (content + embeddings + metadata) | User's Supabase project | User-controlled; service-role for Edge Functions, anon/auth keys for dashboards |
| Contribution source | This repo | Public, FSL-1.1-MIT licensed |
| Community discussions | GitHub Issues, Discord | Per-platform |
| User credentials and secrets | User's environment variables | Never in this repo |

---

## Integration Points

| Integration | Direction | Mechanism |
|-------------|-----------|-----------|
| AI client → User's brain | Inbound | Custom-connector MCP URL, token-authenticated |
| Capture source (Gmail, ChatGPT export, Notion, etc.) → User's brain | Inbound | Recipe-defined Edge Function or local script |
| Dashboard → User's brain | Bidirectional | REST gateway Edge Function (per dashboard) or direct Supabase client (server-side only) |
| Contribution PR → Repo | Inbound | GitHub PR + automated CI + human review |

---

## What This Document Does NOT Cover

This document defines boundaries and decisions, not:
- How to build a personal Open Brain instance → `docs/01-getting-started.md`
- Contribution submission process → `CONTRIBUTING.md`
- Specific schema or extension details → individual contribution folders
- MCP tool surface management → `docs/05-tool-audit.md`
- Companion prompts and workflows → `docs/02-companion-prompts.md`

Those documents are operational; this document is authoritative on system shape.
