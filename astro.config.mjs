import path from "node:path";
import { fileURLToPath } from "node:url";

import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";

import { createStorefrontEmdashIntegration } from "./emdash-commerce-storefront.mjs";

const storefrontRoot = path.dirname(fileURLToPath(import.meta.url));

// Production behind nginx/Caddy/Traefik: configure EmDash trusted proxy headers / env so
// client IP reaches core rate limits (see core 0.7.0 changelog + UPSTREAM_SYNC_CHECKLIST.md).
// Do not enable for local dev without a trusted proxy hop.

/** Prefer originals in Node prod unless Sharp is available and transform is opted in. */
const mediaTransformFlag = process.env.PUBLIC_COMMERCE_MEDIA_TRANSFORM;
const viteMediaTransformDefine =
	mediaTransformFlag !== undefined
		? { "import.meta.env.PUBLIC_COMMERCE_MEDIA_TRANSFORM": JSON.stringify(mediaTransformFlag) }
		: process.env.NODE_ENV === "production"
			? { "import.meta.env.PUBLIC_COMMERCE_MEDIA_TRANSFORM": JSON.stringify("0") }
			: {};

export default defineConfig({
	output: "server",
	adapter: node({
		mode: "standalone",
	}),
	vite: {
		define: viteMediaTransformDefine,
	},
	integrations: [
		react(),
		emdash(
			createStorefrontEmdashIntegration({
				database: sqlite({ url: "file:./data.db" }),
				storage: local({
					directory: path.join(storefrontRoot, "uploads"),
					baseUrl: "/_emdash/api/media/file",
				}),
			}),
		),
	],
	devToolbar: { enabled: false },
});
