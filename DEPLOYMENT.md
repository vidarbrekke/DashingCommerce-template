# Storefront demo — production deployment

This package ships **two** deployment shapes from the same `src/` tree:

| Target                 | Config                 | Database / storage                                   | Typical use                                 |
| ---------------------- | ---------------------- | ---------------------------------------------------- | ------------------------------------------- |
| **Node (SSR)**         | `astro.config.mjs`     | SQLite file + local disk (`./data.db`, `./uploads/`) | VPS, Docker, `node ./dist/server/entry.mjs` |
| **Cloudflare Workers** | `astro.cloudflare.mjs` | D1 + R2 bindings                                     | `wrangler deploy`                           |

Local development uses **Node + SQLite** (`pnpm dev`). Cloudflare is opt-in (`pnpm build:cf`).

Shared EmDash + commerce plugin wiring (upload cap, `commercePlugin()` descriptor, `siteUrl` env) lives in **`emdash-commerce-storefront.mjs`** — change that file once; both Astro configs only pass `database` / `storage`.

**Other EmDash DB backends** (Postgres, Hyperdrive, libSQL) are supported by EmDash; this starter does not ship those configs. Commerce data is dialect-agnostic via plugin storage — see [EmDash database options](https://docs.emdashcms.com/deployment/database/). EmDash runs core migrations (including **054** media upload attempts on 0.32+) on first request after upgrade.

---

## 1. Environment variables (all targets)

| Variable                                                      | When to set                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`EMDASH_SITE_URL`** or **`SITE_URL`**                       | Public `https://…` origin (no path). Required for correct passkeys, OAuth, CSRF, redirects, and sitemap when the app does not see the browser URL (TLS proxy, Workers). Read at **runtime**; you may also set it at **build** time so `emdash()` receives `siteUrl` (see `emdash-site-url.mjs` wired in both Astro configs). |
| **`EMDASH_TRUSTED_PROXY_HEADERS`**                            | Only when a **trusted** reverse proxy forwards real client IPs (see EmDash core changelog ~0.7.0 and `docs/src/content/docs/reference/configuration.mdx`). Wrong values weaken rate limits.                                                                                                                                  |
| **`EMDASH_ADMIN_BEARER`** / **`EMDASH_ADMIN_SESSION_COOKIE`** | Optional; used by demo verification scripts and `admin-auth` fallbacks — **not** a substitute for real admin auth in production.                                                                                                                                                                                             |

Commerce **Stripe** keys and webhook configuration live in **EmDash admin → plugin settings** for dashing-commerce, not only in env vars.

---

## 2. Node production

1. **Build** (from repo root or this directory):

   ```bash
   cd demos/storefront
   pnpm install
   pnpm build
   ```

2. **Run** the standalone server:

   ```bash
   node ./dist/server/entry.mjs
   ```

   Set **`EMDASH_SITE_URL`** (or **`SITE_URL`**) in the process environment to your public HTTPS origin.

3. **Reverse proxy** — If TLS terminates in nginx/Caddy/Traefik, configure EmDash **trusted proxy** behavior and **`siteUrl`** so internal `http://` hops do not break auth (see configuration docs).

4. **Bootstrap** — On a fresh host: run `pnpm bootstrap` (or `emdash init`, `emdash seed`, then commerce seed script) so the DB and plugin storage exist before serving traffic.

---

## 3. Cloudflare Workers

### 3.1 Prerequisites

- Cloudflare account, [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) logged in (`wrangler login`).
- Create **D1** database and **R2** bucket; optionally a **KV** namespace for Astro sessions if you need `wrangler dev` before the first deploy (see below).

```bash
wrangler d1 create dashing-commerce-storefront-cf
wrangler r2 bucket create dashing-commerce-storefront-media
# Optional, for early wrangler dev:
wrangler kv namespace create dashing-commerce-storefront-sessions
```

Paste **`database_id`** into `wrangler.jsonc` (replace `"local"` for remote deploys). Align **`database_name`**, **`bucket_name`**, and worker **`name`** with your account.

### 3.2 D1 read-path coalescing

The Cloudflare config (`astro.cloudflare.mjs`) enables **`d1({ session: "auto", coalesce: true })`** — batches same-request D1 reads at the dialect level. Requires `session: "auto"` (already configured). The Node dev config (`astro.config.mjs`) does **not** enable coalesce.

Commerce catalog queries go through plugin storage, which bypasses EmDash object cache — a future commerce-specific read cache would need its own layer. Do **not** add Workers Cache / `routeRules` HTML caching on **`/shop/checkout`**, **`/shop/cart`**, **`/shop/my-account`**, or admin routes — those paths are personalized or state-changing.

### 3.3 Session storage (KV)

`@astrojs/cloudflare` configures Astro sessions on the **`SESSION`** KV binding. Wrangler may **auto-provision** bindings on first `wrangler deploy`; until then, `wrangler dev` can require an explicit entry:

```jsonc
"kv_namespaces": [
  { "binding": "SESSION", "id": "<namespace_id_from_wrangler_kv_namespace_create>" }
]
```

### 3.4 Build and deploy

From `demos/storefront`:

```bash
pnpm build:cf
wrangler deploy
# or
pnpm deploy:cf
```

Set **`EMDASH_SITE_URL`** (and any secrets) as [Worker vars / secrets](https://developers.cloudflare.com/workers/configuration/environment-variables/) (`wrangler secret put …` or dashboard). For local Worker dev, copy `.dev.vars.example` → **`.dev.vars`**.

### 3.5 Database migrations and seed

Workers use **D1**, not the demo’s local `data.db`.

- **Migrations and CMS seed** run automatically on first Worker request (EmDash boot). No manual `wrangler d1 execute` is required for the core schema when using the starter Worker entry.
- **Cron:** `wrangler.jsonc` includes `triggers.crons` and `src/worker.ts` exports `@emdash-cms/cloudflare/worker` so scheduled publishing and plugin cron run.
- **Commerce catalog fixtures:** `pnpm seed:commerce` targets local SQLite (`data.db`) only. For remote D1, create products in admin or adapt the seed script to your D1 workflow — do not assume the local script writes to production.

### 3.6 Commerce + payments on Workers

- Register real **`PaymentProvider`** implementations (e.g. Stripe) in `commercePlugin({ extensions: { paymentProviders: … } })` when you wire production — the demo uses the default plugin options; production sites inject the map at integration time.
- Configure **Stripe webhook** URL and secrets for your **public** Worker hostname.
- Review **`packages/plugins/dashing-commerce/UPSTREAM_SYNC_CHECKLIST.md`** for money-path tests, proxy headers, and contract checks on each EmDash bump.

### 3.7 Client IP on Cloudflare

Traffic hits Workers directly or via Cloudflare’s edge; **`cf-connecting-ip`** is available at the edge. Follow EmDash + Astro docs for your version for **trusted proxy** and rate limiting — do not copy Node-only `trustedProxyHeaders` values blindly.

---

## 4. Verification commands (optional)

From `demos/storefront`:

- **`pnpm typecheck`** / **`pnpm typecheck:cf`** — Astro check for Node vs Cloudflare config.
- **`pnpm typecheck:scripts`** — `checkJs` on `emdash-*.mjs` integration helpers (`tsconfig.scripts.json`).
- **`pnpm verify:smoke`**, **`pnpm verify:admin`** — HTTP smoke scripts (set `EMDASH_BASE_URL` etc. as in script headers).

---

## 5. Further reading

- [`../../HANDOVER.md`](../../HANDOVER.md) — operational truth and verification commands.
- [`../../packages/plugins/dashing-commerce/docs/LIVE_PAYMENT_VERIFICATION.md`](../../packages/plugins/dashing-commerce/docs/LIVE_PAYMENT_VERIFICATION.md) — Stripe/PayPal sandbox verification.
- [`../../ROADMAP.md`](../../ROADMAP.md) — sequencing.
- `packages/plugins/dashing-commerce/UPSTREAM_SYNC_CHECKLIST.md` — release / upstream gate.
- `docs/src/content/docs/reference/configuration.mdx` — `siteUrl`, `security.allowedDomains`, reverse proxy.
