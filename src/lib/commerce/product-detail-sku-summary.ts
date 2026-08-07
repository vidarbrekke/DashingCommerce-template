import { formatPrice } from "./cart.js";

type SkuSummaryInput = {
	unitPriceMinor: number;
	inventoryQuantity: number;
	status: string;
};

/** One-line summary for product detail when SKUs are loaded. */
export function formatProductDetailSkuSummary(skus: readonly SkuSummaryInput[]): string | null {
	if (skus.length === 0) return null;

	const prices = skus.map((sku) => sku.unitPriceMinor);
	const minPrice = Math.min(...prices);
	const maxPrice = Math.max(...prices);
	const priceLabel =
		minPrice === maxPrice
			? formatPrice(minPrice)
			: `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`;

	const totalStock = skus.reduce((sum, sku) => sum + sku.inventoryQuantity, 0);
	const activeCount = skus.filter((sku) => sku.status === "active").length;

	return `${skus.length} SKU${skus.length === 1 ? "" : "s"} · ${priceLabel} · ${totalStock} in stock · ${activeCount} active`;
}
