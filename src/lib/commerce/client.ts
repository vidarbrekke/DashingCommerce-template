import {
	createStorefrontCommerceClient,
	type CommerceClientConfig,
} from "@emdash-cms/plugin-dashing-commerce/contracts/phase-1-clients";

export function buildClient(baseUrl: string) {
	const config: CommerceClientConfig = {
		baseUrl,
		headers: { "X-EmDash-Request": "1" },
	};
	return createStorefrontCommerceClient(config);
}

export type { CommerceClientConfig };
