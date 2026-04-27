# ROLES

This document defines the authoritative engineering roles used when working on the Open Brain codebase.

Roles define **responsibility, scope, and veto power**.
All contributors (human or AI) must follow these roles when implementing or reviewing changes.

---

## Product Architect (Default Executor)

### Purpose
Own the end-to-end implementation of contributions and infrastructure changes within Open Brain.

### Responsibilities
- Design and implement contributions across schemas, Edge Functions, dashboards, integrations, recipes, and skills
- Ensure correct data flow, metadata shape, and error handling
- Follow `CONSTRAINTS.md`, `WORKFLOW.md`, and `SECURITY.md` at all times
- Keep changes small, reversible, and well-scoped
- Provide clear verification and rollback steps

### Must Not
- Modify core `thoughts` table structure (alter or drop existing columns)
- Introduce local-MCP patterns (`claude_desktop_config.json`, `StdioServerTransport`, local Node servers) for contributions
- Introduce new dependencies without clear justification
- Over-engineer abstractions
- Leave large files or unclear ownership without calling it out

### Cannot Override
- Security Reviewer blocks
- Constraints defined in `CONSTRAINTS.md`

---

## Security Reviewer (Hard Veto Role)

### Purpose
Prevent security regressions and reduce abuse risk in Open Brain contributions and infrastructure.

### Responsibilities
- Review authentication and authorization logic on Edge Functions and webhook receivers
- Review API exposure and server endpoints
- Review CORS, headers, cookies, and token handling
- Identify abuse vectors (rate limiting, public endpoints, embedding-cost amplification)
- Ensure errors do not leak sensitive information or thought content
- Verify secrets are not committed or logged

### Blocking Authority
May block any change that:
- Weakens authentication or access control
- Introduces unauthenticated Edge Functions without explicit justification
- Exposes sensitive data, thought content, or service-role credentials
- Relies on obscurity instead of verification
- Commits secrets or `.env` files

### Must Not
- Optimize for delivery speed
- Suggest "temporary" security shortcuts

---

## Regression Reviewer (QA / Safety)

### Purpose
Catch changes that silently break existing behavior, schemas, or upstream user instances.

### Responsibilities
- Review edge cases and failure modes
- Verify state transitions and lifecycle behavior (especially around ingestion idempotency and dedup)
- Ensure manual verification steps exist
- Ensure rollback is safe and obvious (e.g., `import_batch` tags, schema migration reversibility)
- Identify missing tests or coverage gaps
- Review impact on existing dashboards, recipes, and extensions

### Blocking Authority
May block any change that:
- Lacks clear verification steps
- Risks breaking existing functionality or upstream user instances
- Cannot be easily reverted
- Introduces ambiguous or fragile behavior
- Modifies the core `thoughts` table in a non-additive way

### Must Not
- Require perfect test coverage
- Block changes solely for stylistic reasons

---

## Performance & Scale Reviewer

### Purpose
Protect the responsiveness and cost of Open Brain instances as thought counts grow.

### Responsibilities
- Review query patterns against the `thoughts` table at typical scale (1k–50k rows)
- Review embedding cost amplification (re-embedding loops, missing dedup, redundant capture)
- Review dashboard rendering and re-render behavior
- Identify unnecessary embedding generation, large bundles, or heavy dependencies
- Evaluate impact on Supabase free-tier usage

### Blocking Authority
May block any change that:
- Introduces obvious performance regressions
- Adds heavy libraries without clear benefit
- Creates unbounded embedding-cost loops
- Degrades dashboard or search performance at typical scale

### Must Not
- Prematurely optimize
- Block changes without measurable or observable impact

---

## DX & Maintainability Reviewer

### Purpose
Reduce future debugging, onboarding, and maintenance costs for contributors and upstream users.

### Responsibilities
- Review file size and complexity
- Review clarity of naming and abstractions
- Review README clarity for contributions (per `CONTRIBUTING.md` visual formatting standards)
- Ensure logic is explicit and debuggable
- Flag "clever" code that hides behavior
- Encourage consistency across recipes, dashboards, and Edge Functions

### Blocking Authority
May block any change that:
- Introduces opaque or brittle abstractions
- Creates oversized files without justification
- Increases cognitive load unnecessarily
- Submits a contribution that lacks the required README sections

### Must Not
- Enforce personal style preferences
- Block changes solely for formatting

---

## Role Usage Rules

- One role executes (Product Architect)
- Review roles must be explicitly invoked
- Reviewers may block; executors may not override
- Roles must be switched explicitly during review
- All work must comply with `CONSTRAINTS.md`, `SECURITY.md`, and `WORKFLOW.md`
