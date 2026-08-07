/**
 * Default EmDash media upload cap (multipart + signed URL paths).
 * Must match `STOREFRONT_EMDASH_MAX_UPLOAD_BYTES` in `demos/storefront/emdash-commerce-storefront.mjs`.
 *
 * @see EmDash `maxUploadSize` integration option (default 52_428_800).
 */
export const EMDASH_DEFAULT_MAX_UPLOAD_BYTES = 52_428_800;

export function formatEmDashMediaLimitShort(bytes: number): string {
	const mb = bytes / (1024 * 1024);
	if (mb >= 1 && Math.abs(mb - Math.round(mb)) < 0.05) {
		return `${Math.round(mb)} MB`;
	}
	if (mb >= 1) {
		return `${mb.toFixed(1)} MB`;
	}
	const kb = bytes / 1024;
	return `${Math.max(1, Math.round(kb))} KB`;
}

/**
 * Fail fast before POSTing to `/_emdash/api/media` so oversized files surface
 * with a clear message (and optional UI hint matches server cap).
 */
export function assertFileWithinEmDashMediaUploadLimit(
	file: File,
	maxBytes: number = EMDASH_DEFAULT_MAX_UPLOAD_BYTES,
): void {
	if (file.size > maxBytes) {
		const cap = formatEmDashMediaLimitShort(maxBytes);
		const name = file.name?.trim() || "Image";
		throw new Error(
			`${name} exceeds max upload size (${cap}; file is ${file.size.toLocaleString()} bytes).`,
		);
	}
}
