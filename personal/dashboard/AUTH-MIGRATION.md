# Dashboard Neon Auth migration — 2026-10-03

Live at https://hey-otis.vercel.app. Initial verified deployment:
`dpl_13sf1kpKkuAWuF6v5WXinhDDf8A1`.

## Configuration

- Existing Neon project `silent-wave-89224791`, branch `br-late-cloud-b4nyht2e`, database `neondb`.
- Managed Better Auth enabled; owner account `david.richard@gmail.com` provisioned through Neon.
- Public sign-ups disabled. Email verification required, using OTP.
- Production trusted domain: `https://hey-otis.vercel.app`.
- `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, and `BRAIN_OWNER_EMAIL` configured in Vercel production and preview, and both local environment files.
- The login uses server actions, without a public catch-all auth API. Existing password endpoints are removed and old `dashboard-session` cookies are ignored.
- Verified owner and unexpired session required at page/data boundaries and before Worker mutations. Fresh Neon session checks bypass the SDK’s signed-cookie cache.
- Old password/session environment values remain unused for rollback. Slack and MCP credentials and the restricted database roles are unchanged.

## Verification

- Unit tests: verified owner accepted; missing, other-email, unverified, expired, and malformed sessions rejected; return-path restrictions pass.
- Lint and TypeScript/build pass. Vercel builds with Turbopack; local validation used Webpack because the local Turbopack build worker could not bind a port.
- Production dependency audit: zero vulnerabilities. Full audit still reports five high development-only advisories in the ESLint/fast-glob/braces dependency chain; no forced downgrade applied.
- Real email delivered; user-supplied OTP completed browser sign-in.
- Authenticated browse loaded 50 thought links; thought detail displayed edit controls.
- Authenticated edit action reached the authenticated Worker and returned its invalid-ID validation error; no real thought was modified for this check.
- Other email rejected before sending; anonymous browse/detail, malformed cookies, and previously valid shared-password cookies denied. Removed password login and unexposed signup APIs return 404.
- Deployed candidate and live domain accepted the real Neon session and loaded the dashboard.
- Live browser sign-out redirected to login. Replaying the revoked session against the live dashboard returned 307 to `/login` without thought content.
- Session cookies checked as HttpOnly, Secure, SameSite=Lax. Secret scan passed.

## Provider behavior and delivery follow-up

Better Auth’s first OTP sign-in can return the pre-verification user object even after updating `emailVerified` in the database. Login checks the returned identity, then the redirected dashboard checks the fresh verified session before any data access. It never relies on an unverified user for data authorization.

The shared Neon email sender (`auth@mail.myneon.app`) was used and delivery was verified. Neon recommends a dedicated SMTP sender for production reliability; none was configured during this migration. See https://neon.com/docs/auth/guides/plugins/email-otp .

Use `localhost` for local browser testing. Neon’s localhost trust setting does not trust `127.0.0.1`; a sign-out test on that origin returned `INVALID_ORIGIN`. The real production-domain sign-out and revocation tests passed.

## Rollback

The prior production deployment was `dpl_8by6zLtAbSFQ3BU5vN16j5sL1nuY`. Old local and Vercel shared-password settings remain available for a deliberate rollback. Returning to that deployment restores shared-password authentication and acceptance of its older session cookies. Do not disable Neon Auth or remove its tables to roll back the frontend; it is independent of thought data and Worker integrations.
