import type { CheckoutGetOrderResponseContract } from "@emdash-cms/plugin-dashing-commerce/contracts/route-response-contracts";

export type CheckoutOrderLineItem = CheckoutGetOrderResponseContract["order"]["lineItems"][number];

/**
 * Prefer `productTitle` from checkout line snapshot when present; otherwise product id.
 */
export function checkoutLineItemDisplayName(item: CheckoutOrderLineItem): string {
	const title = item.snapshot?.productTitle;
	if (typeof title === "string") {
		const trimmed = title.trim();
		if (trimmed.length > 0) return trimmed;
	}
	return item.productId;
}
