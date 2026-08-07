import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

const pluginRoot = resolve(__dirname, "../../packages/plugins/dashing-commerce");

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/lib/commerce/**/*.test.ts"],
	},
	resolve: {
		alias: [
			{
				find: /^@emdash-cms\/plugin-dashing-commerce\/media-rendition$/,
				replacement: resolve(pluginRoot, "src/lib/media-rendition.ts"),
			},
			{
				find: /^@emdash-cms\/plugin-dashing-commerce\/money$/,
				replacement: resolve(pluginRoot, "src/lib/money.ts"),
			},
			{
				find: /^@emdash-cms\/plugin-dashing-commerce\/contracts\/(.+)$/,
				replacement: `${resolve(pluginRoot, "src/contracts")}/$1`,
			},
			{
				find: /^@emdash-cms\/plugin-dashing-commerce\/client\/(.+)$/,
				replacement: `${resolve(pluginRoot, "src/client")}/$1`,
			},
			{
				find: "@emdash-cms/plugin-dashing-commerce",
				replacement: resolve(pluginRoot, "src/index.ts"),
			},
		],
	},
});
