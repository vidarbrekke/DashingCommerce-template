import { getPluginSettings } from "emdash";

/** Registered product layout ids. */
export type ProductLayoutId = "classic" | "stacked";

export type StorefrontSkinId = "default" | "warm" | "contrast";

export type StorefrontAppearance = {
	productLayout: ProductLayoutId;
	storefrontSkin: StorefrontSkinId;
};

function asProductLayoutId(value: unknown): ProductLayoutId | null {
	return value === "stacked" || value === "classic" ? value : null;
}

function asStorefrontSkinId(value: unknown): StorefrontSkinId | null {
	return value === "warm" || value === "contrast" || value === "default" ? value : null;
}

/**
 * Resolve layout + skin.
 * Priority: env override → plugin settings (`commerce`) → defaults.
 */
export async function resolveStorefrontAppearance(): Promise<StorefrontAppearance> {
	const envLayout = asProductLayoutId(import.meta.env.STOREFRONT_PRODUCT_LAYOUT);
	const envSkin = asStorefrontSkinId(import.meta.env.STOREFRONT_SKIN);

	let settingsLayout: ProductLayoutId | null = null;
	let settingsSkin: StorefrontSkinId | null = null;
	try {
		const settings = await getPluginSettings("commerce");
		settingsLayout = asProductLayoutId(settings.productLayout);
		settingsSkin = asStorefrontSkinId(settings.storefrontSkin);
	} catch {
		// Settings unavailable during early boot / non-EmDash contexts.
	}

	return {
		productLayout: envLayout ?? settingsLayout ?? "classic",
		storefrontSkin: envSkin ?? settingsSkin ?? "default",
	};
}

export async function resolveProductLayoutId(): Promise<ProductLayoutId> {
	return (await resolveStorefrontAppearance()).productLayout;
}

export async function resolveStorefrontSkinId(): Promise<StorefrontSkinId> {
	return (await resolveStorefrontAppearance()).storefrontSkin;
}
