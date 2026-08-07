/** Registered product layout ids (add variants in product-layout-registry.ts). */
export type ProductLayoutId = "classic" | "stacked";

/**
 * Active product page layout.
 * Priority: STOREFRONT_PRODUCT_LAYOUT env → classic.
 * Template sites can later read plugin settings.productLayout via a storefront config route.
 */
export function resolveProductLayoutId(): ProductLayoutId {
	const fromEnv = import.meta.env.STOREFRONT_PRODUCT_LAYOUT;
	if (fromEnv === "stacked" || fromEnv === "classic") {
		return fromEnv;
	}
	return "classic";
}

export type StorefrontSkinId = "default" | "warm" | "contrast";

export function resolveStorefrontSkinId(): StorefrontSkinId {
	const fromEnv = import.meta.env.STOREFRONT_SKIN;
	if (fromEnv === "warm" || fromEnv === "contrast" || fromEnv === "default") {
		return fromEnv;
	}
	return "default";
}
