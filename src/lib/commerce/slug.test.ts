import { describe, expect, it } from "vitest";

import {
	MAX_PRODUCT_SLUG_LENGTH as storefrontMaxProductSlugLength,
	MIN_PRODUCT_SLUG_LENGTH,
	PRODUCT_SLUG_PATTERN as storefrontPattern,
	PRODUCT_SLUG_PATTERN,
	normalizeSlug,
	validateSlugShape,
} from "./slug.ts";

describe("slug policy behavior", () => {
	const sample = "  Summer-Tee-42  ";

	it("shares canonical slug constants", () => {
		expect(storefrontPattern.source).toBe(PRODUCT_SLUG_PATTERN.source);
		expect(storefrontPattern.flags).toBe(PRODUCT_SLUG_PATTERN.flags);
		expect(storefrontMaxProductSlugLength).toBe(128);
		expect(MIN_PRODUCT_SLUG_LENGTH).toBe(2);
	});

	it("shares normalize and validation behavior", () => {
		expect(normalizeSlug(sample)).toBe(sample.trim().toLowerCase());
		expect(validateSlugShape(normalizeSlug(sample))).toBe(true);
		expect(validateSlugShape("-not-a-slug-")).toBe(false);
	});
});
