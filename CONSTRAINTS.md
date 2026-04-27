# CONSTRAINTS

This document defines the non-negotiable constraints for building and maintaining the Open Brain codebase.

These constraints are **authoritative** and must be followed by all contributors (human or AI) working on Mode 1 (committed code), as defined in `GOVERNANCE.md`.

---

## Product & Project Constraints

- Open Brain is a community contribution repo for a persistent AI memory system (Supabase + pgvector + MCP).
- License is FSL-1.1-MIT. No commercial derivative works. Keep this in mind when generating code or suggesting dependencies.
- Contributions are organized into seven categories: extensions, primitives, recipes, schemas, dashboards, integrations, skills. Every contribution lives in its own subfolder under the right category.
- The repo's value comes from contribution clarity. Beginner-readable READMEs, copy-paste-ready instructions, and verification checkpoints are required per `CONTRIBUTING.md`.

---

## Architecture Constraints

- The core `thoughts` table structure is part of the public contract. Adding columns is fine; altering or dropping existing columns is not.
- MCP servers introduced by extensions or integrations must be remote (deployed as Supabase Edge Functions). Local-MCP patterns (`claude_desktop_config.json`, `StdioServerTransport`, local Node servers) are prohibited for contributions.
- Edge Functions are the only safe place for secret-backed integrations.
- Server-side logic must enforce authentication and authorization explicitly; client-side code is untrusted.
- Contribution scope must stay within the contribution folder; cross-cutting changes that touch core repo files require maintainer alignment first.

---

## Security Constraints

- See `SECURITY.md` for full security posture.
- Secrets must live in environment variables, never in source files.
- All `esm.sh` imports in Edge Functions must pin exact versions (e.g., `@2.39.3`, not `@2`).
- SQL files must not contain `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`, or unqualified `DELETE FROM`.
- No binary blobs over 1MB; no `.exe`, `.dmg`, `.zip`, `.tar.gz`.

---

## Engineering Constraints

- Prefer boring, debuggable solutions over clever abstractions.
- Optimize for clarity over DRY.
- Keep files reasonably sized; large files must be decomposed or called out.
- Changes should be small, scoped, and reversible.
- Avoid introducing new dependencies unless there is a clear and documented benefit.
- Do not refactor broadly without a rollback plan.

---

## Performance Constraints

- Dashboards and ingestion scripts must remain performant at typical scale (1k–50k thoughts).
- Avoid unbounded embedding-cost loops (e.g., re-embedding on every save without dedup).
- Consider bundle size when adding libraries to dashboards.
- Do not introduce obvious performance regressions without justification.

---

## Process Constraints

- All Mode 1 work must follow `WORKFLOW.md`.
- All role responsibilities and vetoes defined in `ROLES.md` apply.
- Public contributions must pass the automated CI gates in `.github/workflows/` before human review.
- When in doubt, call out uncertainty explicitly.
