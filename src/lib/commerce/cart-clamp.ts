import type { StorefrontCommerceClient } from "@emdash-cms/plugin-dashing-commerce/contracts/phase-1-clients";

export type CartLineForClamp = {
	productId: string;
	variantId?: string;
	quantity: number;
	inventoryVersion: number;
	unitPriceMinor: number;
	label: string;
};

export type CartLineClampAdjustment = {
	productId: string;
	variantId?: string;
	label: string;
	requestedQuantity: number;
	allowedQuantity: number;
};

type MutableCartLine = Omit<CartLineForClamp, "label">;

const MAX_CATALOG_LOOKUP = 100;

function lineKey(productId: string, variantId?: string): string {
	return `${productId}::${variantId ?? ""}`;
}

function chunk<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		out.push(items.slice(i, i + size));
	}
	return out;
}

function normalizeAllowedQuantity(raw: number | undefined): number {
	if (!Number.isFinite(raw)) return Number.POSITIVE_INFINITY;
	return Math.max(0, Math.trunc(raw as number));
}

export function clampCartLineItemsToInventory(
	lines: ReadonlyArray<CartLineForClamp>,
	maxByLineKey: ReadonlyMap<string, number>,
): {
	clampedLineItems: MutableCartLine[];
	adjustments: CartLineClampAdjustment[];
} {
	const clampedLineItems: MutableCartLine[] = [];
	const adjustments: CartLineClampAdjustment[] = [];

	for (const line of lines) {
		const allowedRaw = maxByLineKey.get(lineKey(line.productId, line.variantId));
		const allowed = normalizeAllowedQuantity(allowedRaw);
		const requested = Math.max(0, Math.trunc(line.quantity));
		const clamped = Math.min(requested, allowed);

		if (requested !== clamped) {
			adjustments.push({
				productId: line.productId,
				variantId: line.variantId,
				label: line.label,
				requestedQuantity: requested,
				allowedQuantity: clamped,
			});
		}

		if (clamped > 0) {
			clampedLineItems.push({
				productId: line.productId,
				variantId: line.variantId,
				quantity: clamped,
				inventoryVersion: line.inventoryVersion,
				unitPriceMinor: line.unitPriceMinor,
			});
		}
	}

	return { clampedLineItems, adjustments };
}

export function buildCartClampMessage(adjustment: CartLineClampAdjustment): string {
	return `There are only ${adjustment.allowedQuantity} products of ${adjustment.label} in stock. Your shopping cart has been updated with this count`;
}

export async function resolveMaxPurchasableByLine(
	client: Pick<StorefrontCommerceClient, "listProducts" | "getProductBySlug">,
	lines: ReadonlyArray<Pick<CartLineForClamp, "productId" | "variantId">>,
): Promise<Map<string, number>> {
	const maxByLineKey = new Map<string, number>();
	const uniqueProductIds = [...new Set(lines.map((line) => line.productId).filter(Boolean))];
	if (uniqueProductIds.length === 0) return maxByLineKey;

	const slugByProductId = new Map<string, string>();
	for (const ids of chunk(uniqueProductIds, MAX_CATALOG_LOOKUP)) {
		const list = await client.listProducts({ ids, limit: Math.max(1, ids.length) });
		for (const item of list.items) {
			slugByProductId.set(item.product.id, item.product.slug);
		}
	}

	const detailByProductId = new Map<string, Awaited<ReturnType<typeof client.getProductBySlug>>>();
	await Promise.all(
		Array.from(slugByProductId.entries(), async ([productId, slug]) => {
			try {
				detailByProductId.set(productId, await client.getProductBySlug({ slug }));
			} catch {}
		}),
	);

	for (const line of lines) {
		const slug = slugByProductId.get(line.productId);
		if (!slug) continue;
		try {
			const detail = detailByProductId.get(line.productId);
			if (!detail) continue;
			const skuFromMatrix =
				line.variantId && detail.variantMatrix
					? detail.variantMatrix.find((row) => row.skuId === line.variantId)
					: undefined;
			const skuFromList = detail.skus?.find((row) =>
				line.variantId ? row.id === line.variantId : true,
			);
			const max =
				skuFromMatrix?.maxPurchasableQuantity ??
				skuFromList?.maxPurchasableQuantity ??
				Number.POSITIVE_INFINITY;
			maxByLineKey.set(lineKey(line.productId, line.variantId), normalizeAllowedQuantity(max));
		} catch {
			continue;
		}
	}

	return maxByLineKey;
}
