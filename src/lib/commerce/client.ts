import {
	createStorefrontCommerceClient,
	type CommerceClientConfig,
	type PublicPluginApiRouteHandler,
} from "@emdash-cms/plugin-dashing-commerce/contracts/phase-1-clients";

/** Resolve same-worker subrequests against the incoming request (Workers fallback). */
export function createWorkerSafeFetch(ssrRequestUrl: string): typeof fetch {
	return (input, init) => {
		const path =
			typeof input === "string"
				? input
				: input instanceof URL
					? `${input.pathname}${input.search}`
					: (() => {
							const url = new URL(input.url);
							return `${url.pathname}${url.search}`;
						})();
		return globalThis.fetch(new URL(path, ssrRequestUrl), init);
	};
}

export type BuildClientOptions = {
	ssrRequestUrl?: string;
	handlePublicPluginApiRoute?: PublicPluginApiRouteHandler;
};

export function buildClient(baseUrl: string, options?: BuildClientOptions) {
	const isServer = typeof window === "undefined";
	const useInProcess = isServer && options?.handlePublicPluginApiRoute;
	const config: CommerceClientConfig = {
		baseUrl: isServer ? "" : baseUrl,
		headers: { "X-EmDash-Request": "1" },
		ssrRequestUrl: options?.ssrRequestUrl,
		handlePublicPluginApiRoute: options?.handlePublicPluginApiRoute,
	};
	if (isServer && options?.ssrRequestUrl && !useInProcess) {
		config.fetch = createWorkerSafeFetch(options.ssrRequestUrl);
	}
	return createStorefrontCommerceClient(config);
}

export type { CommerceClientConfig, PublicPluginApiRouteHandler };
