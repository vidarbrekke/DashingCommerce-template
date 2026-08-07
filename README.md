# DashingCommerce template

Starter **Astro + EmDash** storefront for [`@emdash-cms/plugin-dashing-commerce`](https://github.com/vidarbrekke/DashingCommerce-for-EmDash).

This repository is **layout only** (pages, `Base.astro`, CSS, seed). Commerce logic lives in the plugin.

## Platforms

| Target | Command | Config |
| ------ | ------- | ------ |
| **Node + SQLite** (default) | `pnpm dev` / `pnpm build` | `astro.config.mjs` |
| **Cloudflare (D1 + R2)** | `pnpm build:cf` / `pnpm deploy:cf` | `astro.cloudflare.mjs` |

Same `src/` for both. See [DEPLOYMENT.md](./DEPLOYMENT.md).

## Install

**While the plugin is GitHub-only**, prefer the monorepo path (always works):

```bash
git clone https://github.com/vidarbrekke/DashingCommerce-for-EmDash.git
cd DashingCommerce-for-EmDash
pnpm install
pnpm --filter dashing-commerce-storefront-demo bootstrap
pnpm --filter dashing-commerce-storefront-demo dev
```

Or scaffold from this template — then follow **[INSTALL.md](./INSTALL.md)** (new site + existing EmDash site).

```bash
npm create astro@latest my-shop -- --template github:vidarbrekke/DashingCommerce-template
```

## Docs

| Doc | Audience |
| --- | -------- |
| [INSTALL.md](./INSTALL.md) | New site **and** existing EmDash install |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Node vs Cloudflare |
| Plugin [GETTING_STARTED.md](https://github.com/vidarbrekke/DashingCommerce-for-EmDash/blob/main/packages/plugins/dashing-commerce/docs/GETTING_STARTED.md) | Full onboarding |

## Status

Not production-complete. Read the plugin [HANDOVER.md](https://github.com/vidarbrekke/DashingCommerce-for-EmDash/blob/main/HANDOVER.md).
