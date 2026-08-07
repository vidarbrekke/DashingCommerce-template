# Add DashingCommerce to an existing EmDash site

Use this when you already have an EmDash Astro project (blog, marketing, custom theme) and want a full-parity shop without replacing your site shell.

**Goal:** plugin APIs + admin + `/shop/*` routes that reuse **your** header/footer/CSS.

**Not production-complete** — see [`HANDOVER.md`](../../../../HANDOVER.md).

---

## Prerequisites

- EmDash **≥ 0.31.1** (SSR / `output: "server"`)
- Ability to register a **native** plugin (`format: "native"`)
- Node **≥ 22** (or Cloudflare Workers for CF deploy)
- Until npm publish: a local clone of [DashingCommerce-for-EmDash](https://github.com/vidarbrekke/DashingCommerce-for-EmDash)

Reference implementation (copy from here):

- Monorepo demo: `demos/storefront/`
- Exported template: `templates/commerce/` or [DashingCommerce-template](https://github.com/vidarbrekke/DashingCommerce-template)

---

## 1. Install the plugin

### GitHub-only (today)

From your site root, with the monorepo checked out as a sibling:

```bash
# Example layout:
#   ~/Dev/DashingCommerce-for-EmDash/
#   ~/Dev/my-emdash-site/

pnpm add ../DashingCommerce-for-EmDash/packages/plugins/dashing-commerce
```

If peer resolution fails (workspace packages), work inside the monorepo storefront or add a pnpm workspace that includes both projects until the plugin is published to npm.

### Future (npm)

```bash
pnpm add @emdash-cms/plugin-dashing-commerce
```

---

## 2. Register the plugin in `astro.config`

```js
import emdash from "emdash/astro";
import {
	COMMERCE_STOREFRONT_DEMO_ENTRYPOINT, // starter providers; swap later
	commercePluginDescriptor,
} from "@emdash-cms/plugin-dashing-commerce";

export default defineConfig({
	output: "server",
	integrations: [
		// …react(), etc.
		emdash({
			// database + storage: keep your existing ports
			plugins: [
				commercePluginDescriptor({
					entrypoint: COMMERCE_STOREFRONT_DEMO_ENTRYPOINT,
				}),
			],
		}),
	],
});
```

Production sites should move off the demo entrypoint and pass `createPlugin({ extensions: { paymentProviders, shippingRateProviders, taxQuoteProviders, checkoutProviderGates } })`. See [`MODULE_PROVIDER_GUIDE.md`](./MODULE_PROVIDER_GUIDE.md).

Shared helper pattern (Node + CF): see `demos/storefront/emdash-commerce-storefront.mjs`.

---

## 3. Copy storefront files (full parity)

Copy these from `demos/storefront` (or the template) into your site, then **adapt imports** so pages use **your** `layouts/Base.astro` (or wrap with it).

### Required routes

| From template | Purpose |
| ------------- | ------- |
| `src/pages/shop/index.astro` | Catalog |
| `src/pages/shop/[slug].astro` | Product detail + add to cart |
| `src/pages/shop/cart.astro` | Cart |
| `src/pages/shop/checkout.astro` | Checkout |
| `src/pages/shop/pay.astro` | Payment |
| `src/pages/shop/status.astro` | Post-checkout status |
| `src/pages/shop/login.astro` | Customer login |
| `src/pages/shop/my-account.astro` | Account home |
| `src/pages/shop/my-account/orders.astro` | Order list |
| `src/pages/shop/order/[orderId].astro` | Order detail |

### Required libraries

| From template | Purpose |
| ------------- | ------- |
| `src/lib/commerce/**` | Client, cart cookies, checkout helpers, variant picker, filters, … |

### Recommended UI pieces

| From template | Purpose |
| ------------- | ------- |
| `src/components/ProductCatalogMeta.astro` | Brand/category chips |
| `src/components/commerce/ProductLayoutClassic.astro` | PDP layout |
| `src/lib/commerce/product-layout-registry.ts` | Layout swap registry |
| `src/lib/commerce/storefront-appearance.ts` | Active layout id |
| `src/lib/commerce/product-detail-page.ts` | PDP data + cart POST |
| `src/pages/pages/[slug].astro` | CMS pages (if you don’t already have one) |
| `src/layouts/PageDefault.astro` | CMS page chrome matching shop tokens |
| `public/no-image.svg` | Placeholder image |
| `public/styles/global.css` **or** merge tokens into your CSS | Shared `.btn`, `.container`, product grid |

### Optional but recommended

| From template | Purpose |
| ------------- | ------- |
| `seed/seed.json` menus / pages snippets | Merge into your seed |
| `scripts/seed-commerce-plugin-storage.mjs` | Commerce catalog seed |
| `emdash-commerce-storefront.mjs` | Shared Node/CF plugin wiring |

**Do not** replace your entire `Base.astro` unless you want the demo chrome. Prefer:

1. Keep your header/footer  
2. Import shared CSS variables (accent, radius, surface)  
3. Add Shop / Cart links to your EmDash **primary** menu in admin  

---

## 4. Seed & menus

1. Ensure a **primary** menu includes `/shop` (and optionally `/pages/about`, `/shop/cart`).
2. If you want CMS legal pages: add a `pages` collection (see template `seed/seed.json`) and route `src/pages/pages/[slug].astro`.
3. Run commerce storage seed if you want demo catalog data:

```bash
node ./scripts/seed-commerce-plugin-storage.mjs
# or from monorepo: pnpm --filter dashing-commerce-storefront-demo seed:commerce
```

---

## 5. Admin configuration

1. `/_emdash/admin/plugins/commerce/setup` — Launch checklist  
2. Payment mode + Stripe/PayPal keys  
3. EasyPost / TaxJar keys (optional)  
4. **Appearance** (product layout / skin) when exposed in settings  
5. Create or import products  

---

## 6. Verify

| Check | Expect |
| ----- | ------ |
| `GET /shop` | Product grid |
| Product → Add to cart | Redirect `/shop/cart` with cookies |
| Checkout → Pay | Matches payment mode |
| `/_emdash/admin/plugins/commerce/products` | Catalog admin |
| `/pages/about` (if seeded) | Same shell styles as shop |

---

## 7. Coherence checklist (layout & style)

- [ ] One site shell for shop + blog + About  
- [ ] Shared CSS variables (`--color-accent`, `--radius`, …)  
- [ ] Shop links in the same nav as CMS pages  
- [ ] Product layouts live in components; routes stay thin  
- [ ] Server reconciles cart prices (never trust client money fields)

---

## Provider swap (starter → production)

Starter (`COMMERCE_STOREFRONT_DEMO_ENTRYPOINT`) registers:

- Flat-rate shipping **or** EasyPost when `EASYPOST_API_KEY` / settings key is set  
- Percent tax **or** TaxJar when key is set  
- PayPal when credentials are set; Stripe via payment settings  

Replace with your own `extensions` map when going live. Guides:

- [`MODULE_PROVIDER_GUIDE.md`](./MODULE_PROVIDER_GUIDE.md)
- [`MONEY_PATH_PROVIDER_GUIDE.md`](./MONEY_PATH_PROVIDER_GUIDE.md)
- [`QUOTE_PROVIDER_GUIDE.md`](./QUOTE_PROVIDER_GUIDE.md)
- [`CHECKOUT_PROVIDER_GATES.md`](./CHECKOUT_PROVIDER_GATES.md)

---

## Troubleshooting

| Symptom | Likely cause |
| ------- | ------------ |
| Plugin not in admin | Not registered as native / wrong `entrypoint` |
| `workspace:` install errors | Plugin not published; use monorepo or `file:` link |
| Cart 401 / claim invalid | Missing `X-EmDash-Request` or owner token cookies |
| Shipping/tax zero | Gates off or no quote providers |
| Styles clash | Copied demo CSS without merging tokens |

---

## Related

- [GETTING_STARTED.md](./GETTING_STARTED.md) — new site path  
- Template [INSTALL.md](https://github.com/vidarbrekke/DashingCommerce-template/blob/main/INSTALL.md)
