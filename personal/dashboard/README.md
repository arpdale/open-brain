# Open Brain personal dashboard

Browse, filter, search, ask questions, and edit thoughts. The dashboard runs on
Vercel using Next.js and a server-only Neon HTTP connection. It uses a dedicated
`open_brain_dashboard` database role with SELECT access; mutations go through the
authenticated Worker update endpoint.

Required server environment variables:

- `DATABASE_URL`: pooled Neon URL for the dashboard read-only role.
- `OPENROUTER_API_KEY`: existing embedding and synthesis provider key.
- `NEON_AUTH_BASE_URL`: managed Neon Auth endpoint.
- `NEON_AUTH_COOKIE_SECRET`: random cookie-signing secret, at least 32 characters.
- `BRAIN_OWNER_EMAIL`: the only verified email allowed to access the dashboard.
- `UPDATE_THOUGHT_URL`, `UPDATE_THOUGHT_SECRET`: Worker endpoint and shared secret.

Keep all credentials server-side. Do not prefix these names with `NEXT_PUBLIC_`.
Neon Auth manages email-code sign-in and sessions. Cookies are HttpOnly, Secure,
and SameSite=Lax in production. The dashboard requires the configured owner
email, verified email ownership, and a live session before reads, searches, or
mutations. The data-access checks bypass the SDK cookie cache so revoked sessions
cannot authorize database reads or Worker updates. Public sign-ups are disabled
in Neon; provision the owner in the Neon console/CLI before first sign-in.

The login uses server actions; it does not expose a catch-all auth proxy or
public account-management endpoints. The old shared password and its session
cookie are no longer accepted. Slack and MCP authentication are independent.

Neon currently sends codes through its shared sender (`auth@mail.myneon.app`).
Neon recommends a dedicated SMTP sender for production delivery reliability;
configure one under Neon Auth email-provider settings when available.
See [Neon Email OTP](https://neon.com/docs/auth/guides/plugins/email-otp).

Run `npm install`, `npm run dev`, `npm run lint`, and `npm run build` here.
Use `http://localhost:3000` for development; Neon’s localhost trust setting does
not include `127.0.0.1` (cookie-bearing requests such as sign-out are rejected).
Configure a candidate preview with Neon and Worker endpoints before changing
production environment settings. The repository-root and dashboard local environment files are separate; keep
their settings consistent. Preserve existing production configuration for rollback.

Search embeds queries with `openai/text-embedding-3-small` through OpenRouter,
uses the existing `match_thoughts` database function, and filters soft-deleted
results after the original over-fetch. Existing stored embeddings are reused.
