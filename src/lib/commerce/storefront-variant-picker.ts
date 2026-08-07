import type { StorefrontProductBySlugResponseContract } from "@emdash-cms/plugin-dashing-commerce/contracts/route-response-contracts";

import { formatPrice } from "./cart.js";

export type VariantPickerMode = "cascading" | "combined";

export type VariantPickerAttributeValue = {
	id: string;
	label: string;
	position: number;
};

export type VariantPickerAttribute = {
	id: string;
	name: string;
	position: number;
	values: VariantPickerAttributeValue[];
};

export type VariantPickerMatrixRow = {
	skuId: string;
	optionByAttributeId: Record<string, string>;
};

export type VariantPickerSkuMeta = {
	unitPriceMinor: number;
	compareAtPriceMinor: number | null;
	priceLabel: string;
	compareLabel: string | null;
	stockLabel: string;
	maxPurchasableQuantity: number;
	fulfillmentLabel: string;
	imageUrl: string | null;
};

export type StorefrontVariantPickerConfig = {
	attributes: VariantPickerAttribute[];
	rows: VariantPickerMatrixRow[];
	skuMetaById: Record<string, VariantPickerSkuMeta>;
	defaultSelections: Record<string, string>;
	defaultSkuId: string;
};

export type VariantPickerChoice = {
	valueId: string;
	label: string;
	position: number;
	purchasable: boolean;
};

type DefiningAttribute = NonNullable<StorefrontProductBySlugResponseContract["attributes"]>[number];

function isVariantDefiningAttribute(
	attribute: DefiningAttribute,
): attribute is DefiningAttribute & { kind: "variant_defining" } {
	return attribute.kind === "variant_defining";
}

function sortDefiningAttributes(
	attributes: readonly DefiningAttribute[] | undefined,
): DefiningAttribute[] {
	return [...(attributes ?? [])]
		.filter(isVariantDefiningAttribute)
		.toSorted((left, right) => left.position - right.position);
}

function matrixRowHasAlignedOptions(
	row: NonNullable<StorefrontProductBySlugResponseContract["variantMatrix"]>[number],
	definingAttributeIds: ReadonlySet<string>,
): boolean {
	const options = row.options ?? [];
	if (options.length === 0) {
		return false;
	}
	if (options.length !== definingAttributeIds.size) {
		return false;
	}
	return options.every((option) => definingAttributeIds.has(option.attributeId));
}

export function resolveVariantPickerMode(
	detail: Pick<StorefrontProductBySlugResponseContract, "product" | "attributes" | "variantMatrix">,
): VariantPickerMode {
	if (detail.product.type !== "variable") {
		return "combined";
	}

	const definingAttributes = sortDefiningAttributes(detail.attributes);
	if (definingAttributes.length === 0) {
		return "combined";
	}

	const definingIds = new Set(definingAttributes.map((attribute) => attribute.id));
	const activeRows = (detail.variantMatrix ?? []).filter((row) => row.status === "active");
	const alignedRows = activeRows.filter((row) => matrixRowHasAlignedOptions(row, definingIds));
	if (alignedRows.length === 0) {
		return "combined";
	}

	return "cascading";
}

export function filterMatrixRowsBySelections(
	rows: readonly VariantPickerMatrixRow[],
	attributes: readonly VariantPickerAttribute[],
	selections: Readonly<Record<string, string>>,
	upToAttributeIndex: number,
): VariantPickerMatrixRow[] {
	return rows.filter((row) => {
		for (let index = 0; index < upToAttributeIndex; index += 1) {
			const attribute = attributes[index];
			if (!attribute) {
				return false;
			}
			const selectedValueId = selections[attribute.id];
			if (!selectedValueId) {
				return false;
			}
			if (row.optionByAttributeId[attribute.id] !== selectedValueId) {
				return false;
			}
		}
		return true;
	});
}

export function getChoicesForAttributeIndex(args: {
	rows: readonly VariantPickerMatrixRow[];
	attributes: readonly VariantPickerAttribute[];
	selections: Readonly<Record<string, string>>;
	attributeIndex: number;
	skuMetaById: Readonly<Record<string, VariantPickerSkuMeta>>;
}): VariantPickerChoice[] {
	const { rows, attributes, selections, attributeIndex, skuMetaById } = args;
	const attribute = attributes[attributeIndex];
	if (!attribute) {
		return [];
	}

	const candidateRows = filterMatrixRowsBySelections(rows, attributes, selections, attributeIndex);
	const choiceByValueId = new Map<string, VariantPickerChoice>();

	for (const row of candidateRows) {
		const valueId = row.optionByAttributeId[attribute.id];
		if (!valueId) {
			continue;
		}
		const valueMeta = attribute.values.find((value) => value.id === valueId);
		if (!valueMeta) {
			continue;
		}
		const skuMeta = skuMetaById[row.skuId];
		const purchasable = (skuMeta?.maxPurchasableQuantity ?? 0) > 0;
		const existing = choiceByValueId.get(valueId);
		if (!existing) {
			choiceByValueId.set(valueId, {
				valueId,
				label: valueMeta.label,
				position: valueMeta.position,
				purchasable,
			});
			continue;
		}
		if (purchasable) {
			existing.purchasable = true;
		}
	}

	return [...choiceByValueId.values()].toSorted((left, right) => left.position - right.position);
}

export function resolveSkuIdFromSelections(args: {
	rows: readonly VariantPickerMatrixRow[];
	attributes: readonly VariantPickerAttribute[];
	selections: Readonly<Record<string, string>>;
}): string | null {
	const { rows, attributes, selections } = args;
	if (attributes.some((attribute) => !selections[attribute.id])) {
		return null;
	}

	const matches = filterMatrixRowsBySelections(rows, attributes, selections, attributes.length);
	if (matches.length !== 1) {
		return null;
	}
	return matches[0]?.skuId ?? null;
}

export function computeDefaultSelections(args: {
	attributes: readonly VariantPickerAttribute[];
	rows: readonly VariantPickerMatrixRow[];
	skuMetaById: Readonly<Record<string, VariantPickerSkuMeta>>;
}): { selections: Record<string, string>; skuId: string | null } {
	const selections: Record<string, string> = {};

	for (let attributeIndex = 0; attributeIndex < args.attributes.length; attributeIndex += 1) {
		const choices = getChoicesForAttributeIndex({
			rows: args.rows,
			attributes: args.attributes,
			selections,
			attributeIndex,
			skuMetaById: args.skuMetaById,
		});
		const preferred = choices.find((choice) => choice.purchasable) ?? choices[0];
		if (!preferred) {
			return { selections, skuId: null };
		}
		const attribute = args.attributes[attributeIndex];
		if (!attribute) {
			return { selections, skuId: null };
		}
		selections[attribute.id] = preferred.valueId;
	}

	return {
		selections,
		skuId: resolveSkuIdFromSelections({
			rows: args.rows,
			attributes: args.attributes,
			selections,
		}),
	};
}

export function buildStorefrontVariantPickerConfig(args: {
	detail: StorefrontProductBySlugResponseContract;
	describeFulfillment: (
		sku: NonNullable<StorefrontProductBySlugResponseContract["skus"]>[number],
	) => string;
}): StorefrontVariantPickerConfig | null {
	const { detail, describeFulfillment } = args;
	if (resolveVariantPickerMode(detail) !== "cascading") {
		return null;
	}

	const definingAttributes = sortDefiningAttributes(detail.attributes);
	const definingIds = new Set(definingAttributes.map((attribute) => attribute.id));
	const skuById = new Map((detail.skus ?? []).map((sku) => [sku.id, sku]));

	const rows: VariantPickerMatrixRow[] = (detail.variantMatrix ?? [])
		.filter((row) => row.status === "active")
		.filter((row) => matrixRowHasAlignedOptions(row, definingIds))
		.map((row) => {
			const optionByAttributeId: Record<string, string> = {};
			for (const option of row.options ?? []) {
				optionByAttributeId[option.attributeId] = option.attributeValueId;
			}
			return { skuId: row.skuId, optionByAttributeId };
		});

	if (rows.length === 0) {
		return null;
	}

	const attributes: VariantPickerAttribute[] = definingAttributes.map((attribute) => ({
		id: attribute.id,
		name: attribute.name,
		position: attribute.position,
		values: attribute.values
			.toSorted((left, right) => left.position - right.position)
			.map((value) => ({
				id: value.id,
				label: value.value,
				position: value.position,
			})),
	}));

	const skuMetaById: Record<string, VariantPickerSkuMeta> = {};
	for (const row of rows) {
		const sku = skuById.get(row.skuId);
		if (!sku) {
			continue;
		}
		const compareMinor =
			sku.compareAtPriceMinor !== undefined && sku.compareAtPriceMinor > sku.unitPriceMinor
				? sku.compareAtPriceMinor
				: null;
		const variantImage = detail.variantMatrix?.find((matrixRow) => matrixRow.skuId === row.skuId)
			?.image?.externalAssetId;
		skuMetaById[row.skuId] = {
			unitPriceMinor: sku.unitPriceMinor,
			compareAtPriceMinor: compareMinor,
			priceLabel: formatPrice(sku.unitPriceMinor),
			compareLabel: compareMinor !== null ? formatPrice(compareMinor) : null,
			stockLabel: sku.stockLabel,
			maxPurchasableQuantity: sku.maxPurchasableQuantity,
			fulfillmentLabel: describeFulfillment(sku),
			imageUrl: typeof variantImage === "string" && variantImage.length > 0 ? variantImage : null,
		};
	}

	const defaults = computeDefaultSelections({ attributes, rows, skuMetaById });
	if (!defaults.skuId) {
		return null;
	}

	return {
		attributes,
		rows,
		skuMetaById,
		defaultSelections: defaults.selections,
		defaultSkuId: defaults.skuId,
	};
}
