import type { StorefrontCommerceClient } from "@emdash-cms/plugin-dashing-commerce/contracts/phase-1-clients";
import type {
	StorefrontProductBySlugResponseContract,
	StorefrontProductListResponseContract,
} from "@emdash-cms/plugin-dashing-commerce/contracts/route-response-contracts";

type StorefrontListItem = StorefrontProductListResponseContract["items"][number];

const MAX_CATALOG_LOOKUP = 100;

export type CartLineVisual = {
	title: string;
	/** Second line under title for variable SKUs (option summary or SKU code). */
	variantSubtitle: string | null;
	/** Resolved image URL/path (`externalAssetId` from commerce, same as PDP). */
	imageSrc: string | null;
	imageAlt: string;
	fulfillmentKind: "digital" | "physical" | "unknown";
};

function chunk<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		out.push(items.slice(i, i + size));
	}
	return out;
}

export function cartLineKey(productId: string, variantId?: string): string {
	return `${productId}::${variantId ?? ""}`;
}

type LineRef = { productId: string; variantId?: string };

/**
 * Resolve titles, optional variant subtitles, and thumbnails for cart line items.
 * Fetches list metadata, then product detail for variable products (for matrix + labels).
 */
export async function resolveCartLineVisuals(
	client: Pick<StorefrontCommerceClient, "listProducts" | "getProductBySlug">,
	lineItems: ReadonlyArray<LineRef>,
): Promise<Map<string, CartLineVisual>> {
	const out = new Map<string, CartLineVisual>();
	const uniqueIds = [...new Set(lineItems.map((l) => l.productId).filter((id) => id.length > 0))];
	if (uniqueIds.length === 0) {
		return out;
	}

	const listById = new Map<string, StorefrontListItem>();
	for (const idChunk of chunk(uniqueIds, MAX_CATALOG_LOOKUP)) {
		const catalog = await client.listProducts({
			ids: idChunk,
			limit: Math.max(idChunk.length, 1),
		});
		for (const item of catalog.items) {
			listById.set(item.product.id, item);
		}
	}

	const detailByProductId = new Map<string, StorefrontProductBySlugResponseContract>();
	await Promise.all(
		uniqueIds.map(async (productId) => {
			const row = listById.get(productId);
			if (row?.product.type !== "variable") {
				return;
			}
			try {
				const d = await client.getProductBySlug({ slug: row.product.slug });
				detailByProductId.set(productId, d);
			} catch {
				// detail optional — still show title from list
			}
		}),
	);

	for (const li of lineItems) {
		const listItem = listById.get(li.productId);
		const title = listItem?.product.title ?? li.productId;
		let variantSubtitle: string | null = null;
		let imageSrc: string | null = listItem?.primaryImage?.externalAssetId ?? null;
		let imageAlt = title;
		let fulfillmentKind: CartLineVisual["fulfillmentKind"] = "unknown";

		const detail = detailByProductId.get(li.productId);
		if (detail?.product.type === "variable" && li.variantId) {
			const matrixRow = detail.variantMatrix?.find((r) => r.skuId === li.variantId);
			variantSubtitle = matrixRow?.variantLabel ?? null;
			if (!variantSubtitle && matrixRow?.skuCode) {
				variantSubtitle = matrixRow.skuCode;
			}
			const variantImg = matrixRow?.image?.externalAssetId;
			if (typeof variantImg === "string" && variantImg.length > 0) {
				imageSrc = variantImg;
				imageAlt = variantSubtitle ?? matrixRow?.skuCode ?? title;
			}
			if (typeof matrixRow?.requiresShipping === "boolean") {
				fulfillmentKind = matrixRow.requiresShipping ? "physical" : "digital";
			}
		}

		out.set(cartLineKey(li.productId, li.variantId), {
			title,
			variantSubtitle,
			imageSrc,
			imageAlt,
			fulfillmentKind,
		});
	}

	return out;
}
