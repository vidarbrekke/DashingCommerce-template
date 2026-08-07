import { describe, expect, it } from "vitest";

import { buildCartClampMessage, clampCartLineItemsToInventory } from "./cart-clamp";

describe("cart-clamp", () => {
	it("clamps quantity to allowed stock", () => {
		const { clampedLineItems, adjustments } = clampCartLineItemsToInventory(
			[
				{
					productId: "prod_1",
					variantId: "sku_1",
					quantity: 7,
					inventoryVersion: 1,
					unitPriceMinor: 1000,
					label: "Blue Shirt / Large",
				},
			],
			new Map([["prod_1::sku_1", 3]]),
		);

		expect(clampedLineItems).toEqual([
			{
				productId: "prod_1",
				variantId: "sku_1",
				quantity: 3,
				inventoryVersion: 1,
				unitPriceMinor: 1000,
			},
		]);
		expect(adjustments).toHaveLength(1);
		expect(buildCartClampMessage(adjustments[0]!)).toBe(
			"There are only 3 products of Blue Shirt / Large in stock. Your shopping cart has been updated with this count",
		);
	});

	it("removes line when allowed quantity is zero", () => {
		const { clampedLineItems, adjustments } = clampCartLineItemsToInventory(
			[
				{
					productId: "prod_2",
					quantity: 2,
					inventoryVersion: 4,
					unitPriceMinor: 500,
					label: "Red Mug",
				},
			],
			new Map([["prod_2::", 0]]),
		);

		expect(clampedLineItems).toEqual([]);
		expect(adjustments).toEqual([
			{
				productId: "prod_2",
				variantId: undefined,
				label: "Red Mug",
				requestedQuantity: 2,
				allowedQuantity: 0,
			},
		]);
	});
});
