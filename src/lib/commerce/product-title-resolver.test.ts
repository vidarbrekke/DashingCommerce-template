import type { StorefrontCommerceClient } from "@emdash-cms/plugin-dashing-commerce/contracts/phase-1-clients";
import { describe, expect, it, vi } from "vitest";

import {
	resolveProductTitlesByIds,
	resolveProductTitlesByLineItems,
} from "./product-title-resolver";

type ListProductsInput = Parameters<StorefrontCommerceClient["listProducts"]>[0] & {
	ids: string[];
};

type CatalogClient = Pick<StorefrontCommerceClient, "listProducts">;
type Response = Awaited<ReturnType<CatalogClient["listProducts"]>>;

function createClientMock(): { client: CatalogClient; listProducts: ReturnType<typeof vi.fn> } {
	const listProducts = vi.fn(
		async ({ ids }: ListProductsInput): Promise<Response> =>
			({
				items: ids
					.filter((id: string) => id !== "prod-missing")
					.map((id: string) => ({
						product: {
							id,
							title: `Title ${id}`,
							slug: `slug-${id}`,
							shortDescription: "",
							status: "active",
							visibility: "public",
						} as Response["items"][number]["product"],
					})),
			}) as Response,
	);

	const client: CatalogClient = {
		listProducts: listProducts as CatalogClient["listProducts"],
	};
	return { client, listProducts };
}

describe("product title resolver", () => {
	it("resolves titles from product ids", async () => {
		const { client, listProducts } = createClientMock();

		const result = await resolveProductTitlesByIds(client, [
			"prod-1",
			"prod-2",
			"prod-1",
			"prod-missing",
		]);

		expect(result.get("prod-1")).toBe("Title prod-1");
		expect(result.get("prod-missing")).toBe("prod-missing");
		expect(listProducts.mock.calls).toHaveLength(1);
	});

	it("hydrates titles from line items", async () => {
		const { client, listProducts } = createClientMock();

		const result = await resolveProductTitlesByLineItems(client, [
			{ productId: "prod-a" },
			{ productId: "prod-b" },
		]);

		expect(result.get("prod-a")).toBe("Title prod-a");
		expect(result.get("prod-b")).toBe("Title prod-b");
		expect(listProducts.mock.calls).toHaveLength(1);
	});

	it("chunks product id lookups at max catalog size", async () => {
		const { client, listProducts } = createClientMock();
		const ids = Array.from({ length: 101 }, (_, index) => `prod-${index + 1}`);

		await resolveProductTitlesByIds(client, ids);

		const calls = listProducts.mock.calls;
		expect(calls).toHaveLength(2);
		expect(calls[0]![0].ids).toHaveLength(100);
		expect(calls[1]![0].ids).toHaveLength(1);
	});
});
