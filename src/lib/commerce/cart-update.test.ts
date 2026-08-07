import { describe, expect, it, vi } from "vitest";

import { updateCartFromForm } from "./cart-update";

function makeFormData(fields: Array<[string, string]>): FormData {
	const form = new FormData();
	for (const [key, value] of fields) form.append(key, value);
	return form;
}

describe("updateCartFromForm", () => {
	it("returns notice with product title when clamped", async () => {
		const upsertCart = vi.fn(async () => ({ ok: true }));
		const client = {
			upsertCart,
			listProducts: vi.fn(async () => ({
				items: [
					{
						product: { id: "prod_1", slug: "blue-shirt", title: "Blue Shirt", type: "simple" },
					},
				],
			})),
			getProductBySlug: vi.fn(async () => ({
				product: { id: "prod_1", type: "simple" },
				skus: [{ id: "sku_1", maxPurchasableQuantity: 2 }],
			})),
		};

		const formData = makeFormData([
			["currency", "USD"],
			["productId", "prod_1"],
			["variantId", "sku_1"],
			["quantity", "7"],
			["inventoryVersion", "1"],
			["unitPriceMinor", "1000"],
			["lineLabel", "prod_1"],
		]);

		const result = await updateCartFromForm(client as never, {
			cartId: "cart_1",
			ownerToken: "token_1",
			formData,
		});

		expect(result.shouldRedirect).toBe(false);
		expect(result.noticeMessage).toContain("Blue Shirt");
		expect(result.noticeMessage).toContain("There are only 2 products");
		expect(upsertCart).toHaveBeenCalledWith(
			expect.objectContaining({
				lineItems: [expect.objectContaining({ quantity: 2 })],
			}),
		);
	});
});
