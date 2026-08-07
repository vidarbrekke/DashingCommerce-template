import type { StorefrontCommerceClient } from "@emdash-cms/plugin-dashing-commerce/contracts/phase-1-clients";

type StorefrontListProductsInput = Parameters<StorefrontCommerceClient["listProducts"]>[0] & {
	ids: string[];
};

type LineItemLike = { productId: string };

const MAX_CATALOG_LOOKUP = 100;

function toUniqueProductIds(productIds: Iterable<string>): string[] {
	const productIdSet = new Set<string>();
	for (const id of productIds) {
		if (typeof id === "string" && id.length > 0) {
			productIdSet.add(id);
		}
	}
	return [...productIdSet];
}

function chunkItems<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}
	return chunks;
}

export async function resolveProductTitlesByIds(
	client: Pick<StorefrontCommerceClient, "listProducts">,
	productIds: Iterable<string>,
): Promise<Map<string, string>> {
	const uniqueIds = toUniqueProductIds(productIds);
	if (uniqueIds.length === 0) {
		return new Map();
	}
	const catalogTitleById = new Map<string, string>();
	const chunks = chunkItems(uniqueIds, MAX_CATALOG_LOOKUP);
	for (const chunk of chunks) {
		const request = {
			ids: chunk,
			limit: chunk.length,
		} as StorefrontListProductsInput;
		const catalog = await client.listProducts(request);
		for (const item of catalog.items) {
			catalogTitleById.set(item.product.id, item.product.title);
		}
	}
	const resolved = new Map<string, string>();
	for (const productId of uniqueIds) {
		resolved.set(productId, catalogTitleById.get(productId) ?? productId);
	}
	return resolved;
}

export async function resolveProductTitlesById(
	client: Pick<StorefrontCommerceClient, "listProducts">,
	productIds: Iterable<string>,
): Promise<Map<string, string>> {
	return resolveProductTitlesByIds(client, productIds);
}

export async function resolveProductTitlesByIdOrFallback(
	client: Pick<StorefrontCommerceClient, "listProducts">,
	productIds: Iterable<string>,
): Promise<Map<string, string>> {
	const uniqueIds = toUniqueProductIds(productIds);
	if (uniqueIds.length === 0) {
		return new Map();
	}
	try {
		return await resolveProductTitlesByIds(client, uniqueIds);
	} catch {
		const fallback = new Map<string, string>();
		for (const id of uniqueIds) {
			fallback.set(id, id);
		}
		return fallback;
	}
}

export async function resolveProductTitlesByLineItems<LineItem extends LineItemLike>(
	client: Pick<StorefrontCommerceClient, "listProducts">,
	lineItems: Iterable<LineItem>,
): Promise<Map<string, string>> {
	const productIds = Array.from(lineItems, (lineItem) => lineItem.productId);
	return resolveProductTitlesByIdOrFallback(client, productIds);
}
