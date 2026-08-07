# Getting started with DashingCommerce

DashingCommerce is two pieces:

| Piece | What it is | Where it lives |
| ----- | ---------- | -------------- |
| **Plugin** | Cart, checkout, payments, admin, APIs | [`@emdash-cms/plugin-dashing-commerce`](https://github.com/vidarbrekke/DashingCommerce-for-EmDash/tree/main/packages/plugins/dashing-commerce) |
| **Storefront (theme)** | Pages, layouts, CSS, seed | [`DashingCommerce-template`](https://github.com/vidarbrekke/DashingCommerce-template) or `demos/storefront` / `templates/commerce` in the monorepo |

Pick your path:

| You are… | Go to |
| -------- | ----- |
| Starting a **new** store | [New site](#a-new-site) |
| Adding commerce to an **existing EmDash** site | [Existing site](./ADD_TO_EXISTING_SITE.md) |
| Deploying Node or Cloudflare | [DEPLOYMENT.md](../../../../demos/storefront/DEPLOYMENT.md) (same for template) |

**Status:** remediation / robustness track — not production-complete. See root [`HANDOVER.md`](../../../../HANDOVER.md).

---

## A. New site

### Recommended while the plugin is GitHub-only

The plugin still uses monorepo `workspace:` dependencies. The reliable path is the monorepo storefront (Node + Cloudflare in one tree):

```bash
git clone https://github.com/vidarbrekke/DashingCommerce-for-EmDash.git
cd DashingCommerce-for-EmDash
pnpm install
pnpm --filter dashing-commerce-storefront-demo bootstrap
pnpm --filter dashing-commerce-storefront-demo dev
```

- Storefront: [http://localhost:4321/shop](http://localhost:4321/shop)
- Admin: [http://localhost:4321/_emdash/admin](http://localhost:4321/_emdash/admin)  
  Dev bypass: `/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`

### Scaffold from the public template

```bash
npm create astro@latest my-shop -- --template github:vidarbrekke/DashingCommerce-template
cd my-shop
```

Then follow **[INSTALL.md](https://github.com/vidarbrekke/DashingCommerce-template/blob/main/INSTALL.md)** in that repo. Until the plugin is published to npm, INSTALL.md explains linking the monorepo plugin package.

### What the starter includes

- Shop routes: `/shop`, product PDP, cart, checkout, pay, account, order status
- Shared shell: `Base.astro`, header, footer, `global.css` (coherent with CMS pages)
- CMS pages: `/pages/[slug]` (About, FAQ, TOS, …)
- Product layout registry (swap classic → more layouts later)
- Seed: menus + `pages` collection sample
- **Starter providers** (replaceable): demo flat shipping / percent tax, EasyPost, TaxJar, Stripe, PayPal — wired via `storefront-demo` entrypoint + admin settings

### Configure integrations (admin)

1. Open **Commerce → Store setup**
2. Run the **Launch checklist**
3. Set keys under plugin settings / **Payment settings**:
   - Stripe / PayPal / payment mode
   - EasyPost / TaxJar (optional; without keys the demo flat-rate + percent tax stay active)
4. Add products under **Products**

Env vars for local provider overrides (optional): `EASYPOST_API_KEY`, `TAXJAR_API_KEY`, `TAXJAR_ENVIRONMENT`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENVIRONMENT`. See [`MODULE_PROVIDER_GUIDE.md`](./MODULE_PROVIDER_GUIDE.md) and [`QUOTE_PROVIDER_GUIDE.md`](./QUOTE_PROVIDER_GUIDE.md).

### Swap demo providers for production

In `astro.config` / `emdash-commerce-storefront.mjs`, omit `COMMERCE_STOREFRONT_DEMO_ENTRYPOINT` and register production providers via `createPlugin({ extensions: { … } })`. Details: [`MODULE_PROVIDER_GUIDE.md`](./MODULE_PROVIDER_GUIDE.md), [`CHECKOUT_PROVIDER_GATES.md`](./CHECKOUT_PROVIDER_GATES.md).

---

## B. Existing EmDash site

Full parity checklist: **[ADD_TO_EXISTING_SITE.md](./ADD_TO_EXISTING_SITE.md)**.

Short version:

1. Install / link the plugin
2. Register `commercePluginDescriptor` as a **native** plugin
3. Copy storefront files (`src/pages/shop/**`, `src/lib/commerce/**`, layouts/components you need)
4. Keep **your** `Base.astro` — merge nav/styles so shop matches the rest of the site
5. Seed menus + optional `pages` collection
6. Configure payments in admin

---

## Architecture (why theme ≠ plugin)

```
Your Astro site (theme)
  ├── layouts/Base.astro      ← header, footer, CSS tokens
  ├── pages/shop/*.astro      ← thin routes; call plugin APIs
  └── pages/pages/[slug].astro

Plugin (engine)
  ├── /_emdash/api/plugins/commerce/*
  └── /_emdash/admin/plugins/commerce/*
```

EmDash does **not** download a theme when you enable a plugin. Themes are chosen at **scaffold / deploy** time. Skins and layout variants can be switched via settings once you wire them (see Store setup → Appearance).

---

## Next reading

- [ADD_TO_EXISTING_SITE.md](./ADD_TO_EXISTING_SITE.md) — file-level checklist
- [LIVE_PAYMENT_VERIFICATION.md](./LIVE_PAYMENT_VERIFICATION.md) — Stripe/PayPal sandbox
- [MARKETPLACE.md](./MARKETPLACE.md) — native vs sandboxed
- Root [ROADMAP.md](../../../../ROADMAP.md)
