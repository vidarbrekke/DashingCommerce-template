export const PRODUCT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const MIN_SLUG_LENGTH = 2;
export const MIN_PRODUCT_SLUG_LENGTH = MIN_SLUG_LENGTH;
export const MAX_SLUG_LENGTH = 128;
export const MAX_PRODUCT_SLUG_LENGTH = MAX_SLUG_LENGTH;

const SLUG_COMBINING_MARKS = /[\u0300-\u036f]/g;
const SLUG_NON_ALPHANUMERIC = /[^a-z0-9\s-]/g;
const SLUG_WHITESPACE_RUNS = /\s+/g;
const SLUG_HYPHEN_RUNS = /-+/g;
const SLUG_LEAD_TRAIL_HYPHENS = /^-+|-+$/g;

export function normalizeProductTitleToSlug(title: string): string {
	return title
		.toLowerCase()
		.normalize("NFKD")
		.replace(SLUG_COMBINING_MARKS, "")
		.replace(SLUG_NON_ALPHANUMERIC, " ")
		.trim()
		.replace(SLUG_WHITESPACE_RUNS, "-")
		.replace(SLUG_HYPHEN_RUNS, "-")
		.replace(SLUG_LEAD_TRAIL_HYPHENS, "");
}

export function normalizeSlug(input: string): string {
	return input.trim().toLowerCase();
}

export function validateSlugShape(slug: string): boolean {
	return (
		slug.length >= MIN_SLUG_LENGTH &&
		slug.length <= MAX_SLUG_LENGTH &&
		PRODUCT_SLUG_PATTERN.test(slug)
	);
}
