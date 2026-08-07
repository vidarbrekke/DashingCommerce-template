import type { StorefrontCommerceClient } from "@emdash-cms/plugin-dashing-commerce/contracts/phase-1-clients";
import { describe, expect, it, vi } from "vitest";

import { cartLineKey, resolveCartLineVisuals } from "./cart-line-visuals";

type VisualClient = Pick<StorefrontCommerceClient, "listProducts" | "getProductBySlug">;
type ListProductsResponse = Awaited<ReturnType<VisualClient["listProducts"]>>;
type ProductDetailResponse = Awaited<ReturnType<VisualClient["getProductBySlug"]>>;

function createClientMock(detailBySlug: Record<string, ProductDetailResponse>): {
	client: VisualClient;
	listProducts: ReturnType<typeof vi.fn>;
	getProductBySlug: ReturnType<typeof vi.fn>;
} {
	const listProducts = vi.fn(
		async ({ ids }: { ids?: string[] }): Promise<ListProductsResponse> =>
			({
				items: (ids ?? []).map((id) => ({
					product: {
						id,
						type: "variable",
						slug: `slug-${id}`,
						title: `Product ${id}`,
						shortDescription: "",
						status: "active",
						visibility: "public",
					},
					primaryImage: {
						linkId: `link-${id}`,
						assetId: `asset-${id}`,
						provider: "local",
						externalAssetId: `https://img.example/${id}.jpg`,
					},
				})),
			}) as ListProductsResponse,
	);

	const getProductBySlug = vi.fn(
		async ({ slug }: { slug: string }): Promise<ProductDetailResponse> => {
			const detail = detailBySlug[slug];
			if (!detail) throw new Error("missing");
			return detail;
		},
	);

	return {
		client: {
			listProducts: listProducts as VisualClient["listProducts"],
			getProductBySlug: getProductBySlug as VisualClient["getProductBySlug"],
		},
		listProducts,
		getProductBySlug,
	};
}

describe("cart line visuals", () => {
	it("marks shipping SKUs as physical", async () => {
		const detail = {
			product: { type: "variable" },
			variantMatrix: [
				{ skuId: "sku-1", skuCode: "SKU1", requiresShipping: true, isDigital: false },
			],
		} as unknown as ProductDetailResponse;
		const { client } = createClientMock({ "slug-prod-1": detail });

		const visuals = await resolveCartLineVisuals(client, [
			{ productId: "prod-1", variantId: "sku-1" },
		]);

		expect(visuals.get(cartLineKey("prod-1", "sku-1"))?.fulfillmentKind).toBe("physical");
	});

	it("marks non-shipping SKUs as digital", async () => {
		const detail = {
			product: { type: "variable" },
			variantMatrix: [
				{ skuId: "sku-1", skuCode: "SKU1", requiresShipping: false, isDigital: true },
			],
		} as unknown as ProductDetailResponse;
		const { client } = createClientMock({ "slug-prod-2": detail });

		const visuals = await resolveCartLineVisuals(client, [
			{ productId: "prod-2", variantId: "sku-1" },
		]);

		expect(visuals.get(cartLineKey("prod-2", "sku-1"))?.fulfillmentKind).toBe("digital");
	});

	it("keeps unknown when matrix row missing", async () => {
		const detail = {
			product: { type: "variable" },
			variantMatrix: [],
		} as unknown as ProductDetailResponse;
		const { client } = createClientMock({ "slug-prod-3": detail });

		const visuals = await resolveCartLineVisuals(client, [
			{ productId: "prod-3", variantId: "sku-missing" },
		]);

		expect(visuals.get(cartLineKey("prod-3", "sku-missing"))?.fulfillmentKind).toBe("unknown");
	});
});
