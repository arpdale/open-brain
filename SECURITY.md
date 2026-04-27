# SECURITY

Security posture and non-negotiable requirements for Open Brain.

This document is **authoritative**. All contributors (human and AI) must follow it.

It states **what must be true**, not how to achieve it.

---

## Security Model

- Client-side code must be treated as untrusted.
- Any server endpoint introduced (Supabase Edge Function, webhook receiver, MCP server) must enforce authentication and authorization explicitly.
- Security is based on verification, not obscurity.

---

## Non-Negotiable Rules

These are absolute. Violation is a bug.

1. Sensitive data (tokens, secrets, credentials, API keys, service-role keys) must never be logged or committed.
2. Secrets must live in environment variables, not source files. Repo files must not contain `.env` or service-role keys.
3. All external inputs must be validated at the boundary.
4. Error messages must not reveal internal state, stack traces, or configuration.
5. CORS must be restrictive in production; wide-open CORS is prohibited.
6. Rate limiting must be applied to abuse-prone endpoints (anything callable without auth, anything embedding-cost-bearing).
7. If a security control cannot be added immediately, the risk must be called out in the PR.
8. Dependencies must be reviewed before adoption; prefer well-maintained packages. Pin exact versions for `esm.sh` imports in Edge Functions.
9. SQL files must not contain `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`, or unqualified `DELETE FROM`.

---

## Sensitive Data Handling

- Do not log secrets, tokens, or authorization headers.
- Do not log raw request bodies if they may contain user data or thought content.
- Do not expose stack traces or configuration details to clients.
- Error messages must be safe-by-default and non-revealing.

---

## Security Review Triggers

Any changes affecting the following require review under the **Security Reviewer** role (see `ROLES.md`):

- Authentication or session handling
- Token handling or verification (Supabase service-role keys, MCP access tokens, brain-key headers)
- CORS configuration
- New external API integrations
- New dependencies
- New Edge Functions
- Anything that handles user-provided input or thought content

---

## Reporting a Vulnerability

If you discover a vulnerability in this repository (CI workflow exploitation, accidentally committed secrets, contribution templates encouraging insecure practices), do not open a public issue. Use GitHub's private vulnerability reporting on the repo, or contact the maintainers via the project's security contact channel.

This policy covers the contents of this repository (contribution templates, metadata schemas, CI workflows, community documentation). It does not cover individual users' upstream Open Brain instances (their Supabase project, their MCP server, their dashboards).
