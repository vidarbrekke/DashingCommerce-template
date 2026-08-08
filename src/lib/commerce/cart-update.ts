import type { StorefrontCommerceClient } from "@emdash-cms/plugin-dashing-commerce/contracts/phase-1-clients";

import {
	buildCartClampMessage,
	clampCartLineItemsToInventory,
	resolveMaxPurchasableByLine,
	type CartLineForClamp,
} from "./cart-clamp";
import { cartLineKey, resolveCartLineVisuals } from "./cart-line-visuals.ts";

type CartUpdateInput = {
	cartId: string;
	ownerToken: string;
	formData: FormData;
};

type CartUpdateDeps = Pick<
	StorefrontCommerceClient,
	"upsertCart" | "listProducts" | "getProductBySlug"
>;

export type CartUpdateResult = {
	shouldRedirect: boolean;
	noticeMessage: string | null;
};

function toInt(v: FormDataEntryValue | null, fallback = 0): number {
	const n = Number(v ?? "");
	return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toRequestedLines(formData: FormData): CartLineForClamp[] {
	const productIds = formData.getAll("productId").map(String);
	const variantIds = formData.getAll("variantId").map(String);
	const quantities = formData.getAll("quantity").map((q) => Math.max(0, toInt(q, 0)));
	const inventoryVersions = formData.getAll("inventoryVersion").map((v) => toInt(v, 0));
	const unitPrices = formData.getAll("unitPriceMinor").map((v) => toInt(v, 0));
	const labels = formData.getAll("lineLabel").map(String);

	return productIds
		.map((productId, i) => ({
			productId,
			variantId: variantIds[i] || undefined,
			quantity: quantities[i] ?? 0,
			inventoryVersion: inventoryVersions[i] ?? 0,
			unitPriceMinor: unitPrices[i] ?? 0,
			label: labels[i] || productId,
		}))
		.filter((item) => item.quantity > 0 && item.productId.length > 0);
}

function resolveLineLabel(
	productId: string,
	currentLabel: string,
	visual: { title: string; variantSubtitle: string | null } | undefined,
): string {
	if (!visual) return currentLabel;
	if (currentLabel !== productId && currentLabel.trim().length > 0) return currentLabel;
	return visual.variantSubtitle ? `${visual.title} / ${visual.variantSubtitle}` : visual.title;
}

export async function updateCartFromForm(
	client: CartUpdateDeps,
	input: CartUpdateInput,
): Promise<CartUpdateResult> {
	const requestedLines = toRequestedLines(input.formData);
	const submitVisualByKey = await resolveCartLineVisuals(client, requestedLines);
	const labeledLines = requestedLines.map((line) => {
		const key = cartLineKey(line.productId, line.variantId);
		return {
			...line,
			label: resolveLineLabel(line.productId, line.label, submitVisualByKey.get(key)),
		};
	});
	const maxByLine = await resolveMaxPurchasableByLine(client, requestedLines);
	const { clampedLineItems, adjustments } = clampCartLineItemsToInventory(labeledLines, maxByLine);
	await client.upsertCart({
		cartId: input.cartId,
		ownerToken: input.ownerToken,
		lineItems: clampedLineItems,
	});

	if (adjustments.length > 0) {
		return {
			shouldRedirect: false,
			noticeMessage: buildCartClampMessage(adjustments[0]!),
		};
	}

	return {
		shouldRedirect: true,
		noticeMessage: null,
	};
}
