import { getI18nConfig, getPluginSetting } from "emdash";

import { COMMERCE_PLUGIN_ID } from "./plugin-store";

/** Loose BCP-47 / Astro path tag (e.g. en, en-US, fr). */
const LOCALE_TAG_RE = /^[a-z]{2,3}(-[a-z0-9_-]+)*$/i;

export type CommerceLocaleSource = "plugin" | "astro-i18n" | "fallback";

export type ResolvedCommerceLocale = {
	/** Locale tag used for commerce admin copy and hints. */
	tag: string;
	source: CommerceLocaleSource;
};

/**
 * Resolve display locale without duplicating EmDash when possible.
 * Precedence: plugin `storeLocale` → Astro i18n default (virtual config) → `en`.
 */
export async function resolveCommerceLocale(): Promise<ResolvedCommerceLocale> {
	const raw = await getPluginSetting<string>(COMMERCE_PLUGIN_ID, "storeLocale");
	const trimmed = typeof raw === "string" ? raw.trim() : "";
	if (trimmed && LOCALE_TAG_RE.test(trimmed)) {
		return { tag: trimmed, source: "plugin" };
	}

	const i18n = getI18nConfig();
	if (i18n?.defaultLocale && LOCALE_TAG_RE.test(i18n.defaultLocale)) {
		return { tag: i18n.defaultLocale, source: "astro-i18n" };
	}
	const first = i18n?.locales?.[0];
	if (typeof first === "string" && LOCALE_TAG_RE.test(first)) {
		return { tag: first, source: "astro-i18n" };
	}

	return { tag: "en", source: "fallback" };
}
