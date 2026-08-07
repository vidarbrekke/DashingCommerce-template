/**
 * Cloudflare Workers build — same `src/` as default `astro.config.mjs`.
 *
 * Usage: `pnpm build:cf` then `wrangler deploy` (see `wrangler.jsonc`).
 * Local Node + SQLite dev stays on `astro.config.mjs` / `pnpm dev`.
 */
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";

import { createStorefrontEmdashIntegration } from "./emdash-commerce-storefront.mjs";

export default defineConfig({
	output: "server",
	// Avoid Cloudflare Images binding (`IMAGES`) — storefront uses static assets; passthrough is enough.
	adapter: cloudflare({ imageService: "passthrough" }),
	vite: {
		// Passthrough rejects `/_image?w=&f=` transforms — serve originals instead.
		define: {
			"import.meta.env.PUBLIC_COMMERCE_MEDIA_TRANSFORM": JSON.stringify("0"),
		},
	},
	integrations: [
		react(),
		emdash(
			createStorefrontEmdashIntegration({
				database: d1({ binding: "DB", session: "auto", coalesce: true }),
				storage: r2({ binding: "MEDIA" }),
			}),
		),
	],
	devToolbar: { enabled: false },
});
