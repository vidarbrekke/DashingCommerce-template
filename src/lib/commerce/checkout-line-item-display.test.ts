import { describe, expect, it } from "vitest";

import { checkoutLineItemDisplayName } from "./checkout-line-item-display.ts";

const baseItem = {
	productId: "prod_1",
	quantity: 1,
	inventoryVersion: 0,
	unitPriceMinor: 100,
} as const;

describe("checkoutLineItemDisplayName", () => {
	it("returns trimmed productTitle from snapshot", () => {
		expect(
			checkoutLineItemDisplayName({
				...baseItem,
				snapshot: { productTitle: "  Wool scarf  " },
			}),
		).toBe("Wool scarf");
	});

	it("falls back to productId when snapshot missing or title blank", () => {
		expect(checkoutLineItemDisplayName({ ...baseItem })).toBe("prod_1");
		expect(
			checkoutLineItemDisplayName({
				...baseItem,
				snapshot: { productTitle: "   " },
			}),
		).toBe("prod_1");
	});
});
