import { describe, expect, it } from "vitest";

import {
	buildStorefrontVariantPickerConfig,
	computeDefaultSelections,
	getChoicesForAttributeIndex,
	resolveSkuIdFromSelections,
	resolveVariantPickerMode,
	type VariantPickerAttribute,
	type VariantPickerMatrixRow,
	type VariantPickerSkuMeta,
} from "./storefront-variant-picker.js";

const colorAttribute: VariantPickerAttribute = {
	id: "attr_color",
	name: "Color",
	position: 0,
	values: [
		{ id: "val_purple", label: "5012 Perfect Purple", position: 0 },
		{ id: "val_ballet", label: "3521 Ballet Shoes", position: 1 },
	],
};

const colorwayAttribute: VariantPickerAttribute = {
	id: "attr_colorway",
	name: "Colorway",
	position: 1,
	values: [
		{ id: "val_sandnes", label: "Sandnes Garn", position: 0 },
		{ id: "val_petite", label: "Petite Knit", position: 1 },
	],
};

const attributes = [colorAttribute, colorwayAttribute];

const rows: VariantPickerMatrixRow[] = [
	{
		skuId: "sku_5012_1",
		optionByAttributeId: { attr_color: "val_purple", attr_colorway: "val_sandnes" },
	},
	{
		skuId: "sku_5012_2",
		optionByAttributeId: { attr_color: "val_purple", attr_colorway: "val_petite" },
	},
	{
		skuId: "sku_3521_1",
		optionByAttributeId: { attr_color: "val_ballet", attr_colorway: "val_sandnes" },
	},
	{
		skuId: "sku_3521_2",
		optionByAttributeId: { attr_color: "val_ballet", attr_colorway: "val_petite" },
	},
];

const skuMetaById: Record<string, VariantPickerSkuMeta> = {
	sku_5012_1: {
		unitPriceMinor: 500,
		compareAtPriceMinor: null,
		priceLabel: "$5.00",
		compareLabel: null,
		stockLabel: "5 in stock",
		maxPurchasableQuantity: 5,
		fulfillmentLabel: "Ships to you",
		imageUrl: null,
	},
	sku_5012_2: {
		unitPriceMinor: 500,
		compareAtPriceMinor: null,
		priceLabel: "$5.00",
		compareLabel: null,
		stockLabel: "Out of stock",
		maxPurchasableQuantity: 0,
		fulfillmentLabel: "Ships to you",
		imageUrl: null,
	},
	sku_3521_1: {
		unitPriceMinor: 600,
		compareAtPriceMinor: null,
		priceLabel: "$6.00",
		compareLabel: null,
		stockLabel: "2 in stock",
		maxPurchasableQuantity: 2,
		fulfillmentLabel: "Ships to you",
		imageUrl: null,
	},
	sku_3521_2: {
		unitPriceMinor: 600,
		compareAtPriceMinor: null,
		priceLabel: "$6.00",
		compareLabel: null,
		stockLabel: "2 in stock",
		maxPurchasableQuantity: 2,
		fulfillmentLabel: "Ships to you",
		imageUrl: null,
	},
};

describe("resolveVariantPickerMode", () => {
	it("uses cascading mode when variable matrix rows align with defining attributes", () => {
		const mode = resolveVariantPickerMode({
			product: { type: "variable" } as never,
			attributes: [
				{
					id: "attr_color",
					kind: "variant_defining",
					position: 0,
					name: "Color",
					code: "color",
					productId: "prod_1",
					createdAt: "t",
					updatedAt: "t",
					values: [],
				},
				{
					id: "attr_colorway",
					kind: "variant_defining",
					position: 1,
					name: "Colorway",
					code: "colorway",
					productId: "prod_1",
					createdAt: "t",
					updatedAt: "t",
					values: [],
				},
			],
			variantMatrix: [
				{
					skuId: "sku_a",
					skuCode: "A",
					status: "active",
					unitPriceMinor: 100,
					requiresShipping: true,
					isDigital: false,
					availability: "in_stock",
					maxPurchasableQuantity: 1,
					stockLabel: "5 in stock",
					options: [
						{ attributeId: "attr_color", attributeValueId: "val_a" },
						{ attributeId: "attr_colorway", attributeValueId: "val_b" },
					],
				},
			],
		});
		expect(mode).toBe("cascading");
	});

	it("falls back to combined mode when matrix options are incomplete", () => {
		const mode = resolveVariantPickerMode({
			product: { type: "variable" } as never,
			attributes: [
				{
					id: "attr_color",
					kind: "variant_defining",
					position: 0,
					name: "Color",
					code: "color",
					productId: "prod_1",
					createdAt: "t",
					updatedAt: "t",
					values: [],
				},
				{
					id: "attr_size",
					kind: "variant_defining",
					position: 1,
					name: "Size",
					code: "size",
					productId: "prod_1",
					createdAt: "t",
					updatedAt: "t",
					values: [],
				},
			],
			variantMatrix: [
				{
					skuId: "sku_a",
					skuCode: "A",
					status: "active",
					unitPriceMinor: 100,
					requiresShipping: true,
					isDigital: false,
					availability: "in_stock",
					maxPurchasableQuantity: 1,
					stockLabel: "5 in stock",
					options: [{ attributeId: "attr_color", attributeValueId: "val_a" }],
				},
			],
		});
		expect(mode).toBe("combined");
	});
});

describe("cascading variant choices", () => {
	it("lists all colors before any colorway is chosen", () => {
		const choices = getChoicesForAttributeIndex({
			rows,
			attributes,
			selections: {},
			attributeIndex: 0,
			skuMetaById,
		});
		expect(choices.map((choice) => choice.label)).toEqual([
			"5012 Perfect Purple",
			"3521 Ballet Shoes",
		]);
	});

	it("filters colorways after a color is selected", () => {
		const choices = getChoicesForAttributeIndex({
			rows,
			attributes,
			selections: { attr_color: "val_purple" },
			attributeIndex: 1,
			skuMetaById,
		});
		expect(choices.map((choice) => choice.label)).toEqual(["Sandnes Garn", "Petite Knit"]);
		expect(choices.find((choice) => choice.label === "Petite Knit")?.purchasable).toBe(false);
	});

	it("resolves a single sku when all dimensions are selected", () => {
		const skuId = resolveSkuIdFromSelections({
			rows,
			attributes,
			selections: { attr_color: "val_ballet", attr_colorway: "val_sandnes" },
		});
		expect(skuId).toBe("sku_3521_1");
	});

	it("prefers the first purchasable default combination", () => {
		const defaults = computeDefaultSelections({ attributes, rows, skuMetaById });
		expect(defaults.skuId).toBe("sku_5012_1");
		expect(defaults.selections).toEqual({
			attr_color: "val_purple",
			attr_colorway: "val_sandnes",
		});
	});
});

describe("buildStorefrontVariantPickerConfig", () => {
	it("returns null when matrix data cannot support cascading pickers", () => {
		const config = buildStorefrontVariantPickerConfig({
			detail: {
				product: { type: "variable" } as never,
				attributes: [],
				variantMatrix: [],
				skus: [],
			},
			describeFulfillment: () => "Ships to you",
		});
		expect(config).toBeNull();
	});
});
