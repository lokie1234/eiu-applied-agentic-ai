# Request protection on Vercel / Supabase Free

Apply `supabase/migrations/202610280001_request_rate_limits.sql` in Supabase SQL Editor **before deploying this code**. It creates one RLS-protected table and a server-only RPC; it does not modify lesson or learner records. No extra paid service is required. `SUPABASE_SECRET_KEY` (or the existing service-role key), `NEXT_PUBLIC_SUPABASE_URL`, and `PASSCODE_SESSION_SECRET` must be configured on Vercel. Use the same stable signing secret across instances.

The limiter runs in `proxy.ts`, before application/database-heavy route work. Missing migration or database failure returns `503` and fails closed. Check the migration and RPC permissions if all protected requests return `503`; do not deploy first and leave the migration for later. Authorization still runs independently inside every protected route.

| Request group | Per browser, per 60-second fixed window | Shared-IP guard on Vercel |
| --- | --- | --- |
| Full page loads/reloads, across `/`, `/learn`, `/admin` | 5 | 500 |
| Login attempts, shared across learner and admin login | 5 | 500 |
| RSC, prefetch, HEAD and other page-data requests | 120 | 3,000 |
| API reads, including polling/content | 240 | 6,000 |
| Presence heartbeat POST | 12 | 1,500 |
| Other API writes, shared across endpoints | 5 | 500 |

The request exceeding a threshold receives `429`, `Retry-After`, and a two-minute cooldown for its group. Blocked retries do not extend that cooldown. Counters reset after cooldown. Assets, OPTIONS, signout and the OAuth callback do not consume these counters. RSC/prefetch/HEAD page requests use a separate larger budget; they cannot bypass enforcement just by setting headers. Normal API reads and heartbeat writes have separate budgets so polling does not count as repeated F5/login. A notice appears for API throttling; throttled full page loads receive a small bilingual notice page with HTTP 429, without rendering the expensive app.

Each browser receives a signed, HttpOnly, one-day identity cookie. This avoids treating 50 learners on the same Wi-Fi as one person. Clearing cookies starts a new browser identity; the higher network guard limits this bypass. Network guards trust the Vercel-managed `X-Forwarded-For` only when running on Vercel. On other hosting, configure a trusted edge/network guard separately. No raw IP or credentials are stored in rate-limit rows. All Vercel instances share atomic database counters; there is no in-memory enforcement fallback. Expired counters are removed in bounded batches during later requests.

This is application abuse protection, not a volumetric DDoS shield: requests still reach Vercel and the limiter RPC. Configure Vercel Firewall and monitor function invocations, RPC latency, 429/503 rates and Supabase usage for edge-level protection. Shared-IP thresholds are deliberately higher than individual thresholds and should be tuned from actual class usage.

Admin password login is exclusively `POST /api/auth/admin`, shown inline within the EIU administrator card in the Google panel and submitted automatically once six digits are entered. Learner/teaching login no longer grants admin privileges from an admin password. Both login endpoints share the same attempt bucket. Admin passwords stay server-side.

Relevant provider documentation: [Vercel request headers](https://vercel.com/docs/headers/request-headers), [Supabase database functions and privileges](https://supabase.com/docs/guides/database/functions).
