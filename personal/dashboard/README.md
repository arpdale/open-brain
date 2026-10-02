# Open Brain personal dashboard

Browse, filter, search, ask questions, and edit thoughts. The dashboard runs on
Vercel using Next.js and a server-only Neon HTTP connection. It uses a dedicated
`open_brain_dashboard` database role with SELECT access; mutations go through the
authenticated Worker update endpoint.

Required server environment variables:

- `DATABASE_URL`: pooled Neon URL for the dashboard read-only role.
- `OPENROUTER_API_KEY`: existing embedding and synthesis provider key.
- `BRAIN_PASSWORD`, `SESSION_SECRET`: existing password and signed-session secrets.
- `UPDATE_THOUGHT_URL`, `UPDATE_THOUGHT_SECRET`: Worker endpoint and shared secret.

Keep all credentials server-side. Do not prefix these names with `NEXT_PUBLIC_`.
The production session lasts 30 days and uses an HttpOnly, Secure, SameSite=Lax
cookie. Every mutation verifies the session again before contacting the Worker.

Run `npm install`, `npm run dev`, `npm run lint`, and `npm run build` here.
Configure a candidate preview with Neon and Worker endpoints before changing
production environment settings. The repository root environment symlink is for
local use only; preserve existing production configuration for rollback.

Search embeds queries with `openai/text-embedding-3-small` through OpenRouter,
uses the existing `match_thoughts` database function, and filters soft-deleted
results after the original over-fetch. Existing stored embeddings are reused.
