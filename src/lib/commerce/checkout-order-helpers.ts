import type { CheckoutGetOrderResponseContract } from "@emdash-cms/plugin-dashing-commerce/contracts/route-response-contracts";

export type CheckoutOrder = CheckoutGetOrderResponseContract["order"];

export function orderNeedsShipping(order: CheckoutOrder): boolean {
	if (order.appliedShipping) {
		return false;
	}
	return order.lineItems.some((line) => line.snapshot?.requiresShipping === true);
}

export function orderNeedsTax(order: CheckoutOrder): boolean {
	return !order.appliedTax;
}

export function cartLineItemsRequireShipping(
	lineItems: ReadonlyArray<{ requiresShipping?: boolean }>,
): boolean {
	return lineItems.some((line) => line.requiresShipping === true);
}
