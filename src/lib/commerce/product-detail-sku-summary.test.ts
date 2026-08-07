import { describe, expect, it } from "vitest";

import { formatProductDetailSkuSummary } from "./product-detail-sku-summary.js";

describe("formatProductDetailSkuSummary", () => {
	it("returns null for empty SKU list", () => {
		expect(formatProductDetailSkuSummary([])).toBeNull();
	});

	it("summarizes single SKU", () => {
		const summary = formatProductDetailSkuSummary([
			{ unitPriceMinor: 1999, inventoryQuantity: 12, status: "active" },
		]);
		expect(summary).toContain("1 SKU");
		expect(summary).toContain("12 in stock");
		expect(summary).toContain("1 active");
	});

	it("shows price range for multiple SKUs", () => {
		const summary = formatProductDetailSkuSummary([
			{ unitPriceMinor: 1000, inventoryQuantity: 1, status: "active" },
			{ unitPriceMinor: 2500, inventoryQuantity: 2, status: "inactive" },
		]);
		expect(summary).toContain("2 SKUs");
		expect(summary).toMatch(/–/);
		expect(summary).toContain("3 in stock");
		expect(summary).toContain("1 active");
	});
});
