import {
	COMMERCE_STOREFRONT_DEMO_ENTRYPOINT,
	commercePluginDescriptor,
} from "@emdash-cms/plugin-dashing-commerce";

import { emdashSiteUrlFromEnv } from "./emdash-site-url.mjs";

/**
 * Keep in sync with `src/lib/commerce/emdash-media-limits.ts` (`EMDASH_DEFAULT_MAX_UPLOAD_BYTES`).
 */
export const STOREFRONT_EMDASH_MAX_UPLOAD_BYTES = 52_428_800;

/**
 * Shared `emdash({ ... })` options for Node and Cloudflare — only `database` + `storage` differ per target.
 *
 * @param {{ readonly database: import("emdash").DatabaseDescriptor; readonly storage: import("emdash").StorageDescriptor }} ports
 */
export function createStorefrontEmdashIntegration(ports) {
	return {
		...emdashSiteUrlFromEnv(),
		database: ports.database,
		storage: ports.storage,
		maxUploadSize: STOREFRONT_EMDASH_MAX_UPLOAD_BYTES,
		plugins: [
			commercePluginDescriptor({
				entrypoint: COMMERCE_STOREFRONT_DEMO_ENTRYPOINT,
			}),
		],
	};
}
