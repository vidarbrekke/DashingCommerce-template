import { getPluginSetting } from "emdash";

export const COMMERCE_PLUGIN_ID = "commerce" as const;

const ISO_4217_ALPHA = /^[A-Z]{3}$/;

/** Normalize plugin `defaultCurrency` to a 3-letter ISO 4217 code for labels. */
export function normalizeIso4217Currency(raw: unknown): string {
	if (typeof raw !== "string") return "USD";
	const trimmed = raw.trim().toUpperCase();
	return ISO_4217_ALPHA.test(trimmed) ? trimmed : "USD";
}

export async function getCommerceDisplayCurrency(): Promise<string> {
	// Treat resolved value as read-only (EmDash may dedupe/cache plugin settings per request).
	const fromSettings = await getPluginSetting<string>(COMMERCE_PLUGIN_ID, "defaultCurrency");
	return normalizeIso4217Currency(fromSettings);
}
