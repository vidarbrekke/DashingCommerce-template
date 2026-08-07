# Install DashingCommerce storefront

This template is the **site layout** (pages, styles, seed). The commerce **plugin** is separate: [DashingCommerce-for-EmDash](https://github.com/vidarbrekke/DashingCommerce-for-EmDash).

---

## Path A — New site (easiest today)

The plugin is **GitHub-only** and still resolves EmDash packages via the monorepo. Use the monorepo demo (same `src/` as this template):

```bash
git clone https://github.com/vidarbrekke/DashingCommerce-for-EmDash.git
cd DashingCommerce-for-EmDash
pnpm install
pnpm --filter dashing-commerce-storefront-demo bootstrap
pnpm --filter dashing-commerce-storefront-demo dev
```

| URL | What |
| --- | ---- |
| http://localhost:4321/shop | Storefront |
| http://localhost:4321/_emdash/admin | Admin |
| `/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin` | Dev login |

**Cloudflare:** `pnpm --filter dashing-commerce-storefront-demo build:cf` then `deploy:cf` — see [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Path B — Scaffold this template, then attach the plugin

```bash
npm create astro@latest my-shop -- --template github:vidarbrekke/DashingCommerce-template
cd my-shop
```

### B1. Clone the plugin monorepo (sibling)

```bash
cd ..
git clone https://github.com/vidarbrekke/DashingCommerce-for-EmDash.git
cd my-shop
```

### B2. Link the plugin

```bash
pnpm add ../DashingCommerce-for-EmDash/packages/plugins/dashing-commerce
pnpm add emdash@^0.32.0 @emdash-cms/cloudflare@^0.32.0
```

If install fails on `workspace:` peers, use **Path A** until the plugin is published to npm. After publish, `package.json` will use `@emdash-cms/plugin-dashing-commerce` from the registry and Path B becomes one-command.

### B3. Bootstrap & run

```bash
pnpm install
pnpm bootstrap   # emdash init + seed + commerce seed
pnpm dev         # Node + SQLite
# or: pnpm build:cf && pnpm deploy:cf
```

---

## Path C — Existing EmDash site

Do **not** replace your whole project with this template. Copy shop routes and `src/lib/commerce` into your site and keep your `Base.astro`.

Full checklist: [ADD_TO_EXISTING_SITE.md](https://github.com/vidarbrekke/DashingCommerce-for-EmDash/blob/main/packages/plugins/dashing-commerce/docs/ADD_TO_EXISTING_SITE.md).

---

## Starter integrations (replaceable)

The demo entrypoint (`COMMERCE_STOREFRONT_DEMO_ENTRYPOINT`) enables:

| Integration | Without API keys | With keys (env or admin settings) |
| ----------- | ---------------- | --------------------------------- |
| Shipping | Flat-rate demo | EasyPost |
| Tax | Percent demo | TaxJar |
| Payments | Simulated mode | Stripe and/or PayPal |

Configure in **Admin → Commerce → Store setup / Payment settings**. Swap providers in code via `createPlugin({ extensions })` — see the plugin [MODULE_PROVIDER_GUIDE.md](https://github.com/vidarbrekke/DashingCommerce-for-EmDash/blob/main/packages/plugins/dashing-commerce/docs/MODULE_PROVIDER_GUIDE.md).

---

## After install

1. Open **Commerce → Store setup** and run the launch checklist  
2. Add products  
3. Place a test order (simulated payment is fine)  
4. Read [GETTING_STARTED.md](https://github.com/vidarbrekke/DashingCommerce-for-EmDash/blob/main/packages/plugins/dashing-commerce/docs/GETTING_STARTED.md)

---

## Sync from monorepo

Maintainers regenerate this repo from `demos/storefront`:

```bash
# in DashingCommerce-for-EmDash
node scripts/export-commerce-template.mjs --out ../DashingCommerce-template
```
