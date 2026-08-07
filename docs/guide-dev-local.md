# Deploy to Local — Dev Guide

## Quick start (preserves existing data)

```bash
cd demos/storefront
pnpm dev
```

`predev` rebuilds packages (`emdash` + `plugin-dashing-commerce`).
`dev` starts Astro dev on `http://localhost:4321`.
Existing `data.db` and `uploads/` are untouched — products, categories, SKUs, orders, inventory, and media stay.

Restarting Astro (`pkill` + `astro dev`, rebuilding the plugin, etc.) does **not** reset the database or media.

For Stripe Payment Element test checkout (keys, `stripe listen`, admin `whsec_`), see [`guide-stripe-test-setup.md`](./guide-stripe-test-setup.md).

## Full bootstrap (resets everything)

Only run when you need a clean demo from scratch:

```bash
cd demos/storefront
pnpm bootstrap
```

This runs: `emdash init` → `emdash seed` → `seed-commerce-plugin-storage.mjs`.
Existing `data.db` is overwritten with fresh fixtures. `uploads/` is not deleted by bootstrap, but media rows may no longer match files on disk.

## Database and media lifecycle

| Action                                            | DB preserved? | Media (`uploads/`) | Notes                                           |
| ------------------------------------------------- | ------------- | ------------------ | ----------------------------------------------- |
| `pnpm dev` / `astro dev` restart                  | Yes           | Yes                | Rebuilds packages only                          |
| Plugin `build`                                    | Yes           | Yes                | Safe anytime                                    |
| Playwright with `PLAYWRIGHT_BASE_URL` set         | Yes           | Yes                | Reuses running server; no reset                 |
| Playwright local, no `PLAYWRIGHT_BASE_URL`        | Yes           | Yes                | Starts `:4173` build+dev; **no** DB wipe        |
| Playwright `CI=1` or `PLAYWRIGHT_RESET_DEMO_DB=1` | **No**        | Yes (files)        | Starts `:4173` via `reset-demo-db.mjs` + reseed |
| `pnpm bootstrap`                                  | No            | Partial            | Overwrites DB; leaves upload files              |
| `node scripts/reset-demo-db.mjs`                  | No            | Yes                | Deletes `data.db` (+ WAL/SHM) only              |
| `pnpm verify:smoke`                               | No            | Yes                | Runs `reset-demo-db` internally                 |

`data.db` lives at `demos/storefront/data.db` (gitignored). SQLite WAL files (`data.db-shm`, `data.db-wal`) carry committed transactions. Local media lives in `demos/storefront/uploads/`.

## Playwright / automated browser tests

**Always point tests at your running demo when you want to keep admin data:**

```bash
# From repo root, with Astro already on :4321
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4321 \
  pnpm --filter dashing-commerce-storefront-demo test:e2e:commerce-admin

PLAYWRIGHT_BASE_URL=http://127.0.0.1:4321 \
  pnpm --filter dashing-commerce-storefront-demo browser:create-variable-product
```

If `PLAYWRIGHT_BASE_URL` is unset locally, `playwright.config.ts` starts `:4173` with build+dev and **does not** wipe `data.db`. Destructive reset runs only when `CI` is set or `PLAYWRIGHT_RESET_DEMO_DB=1`. Prefer `PLAYWRIGHT_BASE_URL` against your `:4321` demo for day-to-day admin work.

## Rebuild packages without touching DB

```bash
cd demos/storefront
pnpm --dir ../.. --filter emdash --filter @emdash-cms/plugin-dashing-commerce run build
```

This is exactly what `predev` does. Data is safe.

## Backup before intentional resets

```bash
cd demos/storefront
node scripts/backup-db.mjs
```

## Seed commerce data after `reset-demo-db`

If you ran the reset script or want fresh commerce fixtures:

```bash
cd demos/storefront
emdash init && emdash seed && node scripts/seed-commerce-plugin-storage.mjs
```

Or shorthand:

```bash
pnpm bootstrap
```

## Verify server has data

```bash
sqlite3 data.db "SELECT id, collection FROM _plugin_storage WHERE plugin_id='commerce' LIMIT 10;"
```

A fresh seed produces products, SKUs, and inventory from `.emdash/commerce-fixtures.json` (categories are empty unless you add them in admin or fixtures).

## Dangers to avoid

1. **Never run `verify-storefront-smoke.sh` during active development.** It deletes `data.db`.
2. **Never run `reset-demo-db.mjs` unless you intend to reseed.**
3. Prefer `PLAYWRIGHT_BASE_URL` against your `:4321` demo. Local Playwright without it no longer wipes `data.db`; `CI` / `PLAYWRIGHT_RESET_DEMO_DB=1` still does.
4. **`predev` runs automatically before `dev`.** It rebuilds packages but does not touch the database or media.
