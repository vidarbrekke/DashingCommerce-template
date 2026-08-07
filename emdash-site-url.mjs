/**
 * Optional `siteUrl` for `emdash()` when `EMDASH_SITE_URL` or `SITE_URL` is set.
 * Normalizes to origin (no path). Invalid URLs are ignored so local dev keeps working.
 *
 * @returns {{ siteUrl: string } | Record<string, never>}
 */
export function emdashSiteUrlFromEnv() {
	const raw = process.env.EMDASH_SITE_URL?.trim() || process.env.SITE_URL?.trim();
	if (!raw) return {};
	try {
		return { siteUrl: new URL(raw).origin };
	} catch {
		return {};
	}
}
