import {
	getChoicesForAttributeIndex,
	resolveSkuIdFromSelections,
	type StorefrontVariantPickerConfig,
} from "./storefront-variant-picker.js";

const CONFIG_ATTR = "data-variant-picker-config";
const OPTION_SELECT = "[data-variant-option-select]";
const SKU_INPUT = "[data-variant-picker-sku]";
const PRICE_EL = "[data-variant-picker-price]";
const COMPARE_EL = "[data-variant-picker-compare]";
const FULFILLMENT_EL = "[data-variant-picker-fulfillment]";
const STOCK_EL = "#product-stock-status";
const ADD_TO_CART_EL = "#product-add-to-cart";
const QUANTITY_FIELD_EL = "[data-product-quantity-field]";
const QUANTITY_EL = "#quantity";
const MAIN_IMAGE_EL = "#product-main-image";

type PickerElements = {
	root: HTMLElement;
	config: StorefrontVariantPickerConfig;
	selects: HTMLSelectElement[];
	skuInput: HTMLInputElement;
	priceEl: HTMLElement | null;
	compareEl: HTMLElement | null;
	fulfillmentEl: HTMLElement | null;
	stockEl: HTMLElement | null;
	addToCartButton: HTMLButtonElement | null;
	quantityField: HTMLElement | null;
	quantityInput: HTMLInputElement | null;
	mainImage: HTMLImageElement | null;
	heroImageUrl: string;
};

function parseConfig(root: HTMLElement): StorefrontVariantPickerConfig | null {
	const raw = root.getAttribute(CONFIG_ATTR);
	if (!raw) {
		return null;
	}
	try {
		return JSON.parse(raw) as StorefrontVariantPickerConfig;
	} catch {
		return null;
	}
}

function fillSelectOptions(
	select: HTMLSelectElement,
	attributeName: string,
	choices: ReturnType<typeof getChoicesForAttributeIndex>,
	selectedValueId: string,
): void {
	select.replaceChildren();
	const placeholder = document.createElement("option");
	placeholder.value = "";
	placeholder.textContent = `Choose ${attributeName}`;
	select.append(placeholder);

	for (const choice of choices) {
		const option = document.createElement("option");
		option.value = choice.valueId;
		option.textContent = choice.purchasable ? choice.label : `${choice.label} (out of stock)`;
		option.disabled = !choice.purchasable;
		select.append(option);
	}

	if (selectedValueId) {
		select.value = selectedValueId;
	}
}

function readSelections(selects: HTMLSelectElement[], _config: StorefrontVariantPickerConfig) {
	const selections: Record<string, string> = {};
	for (const select of selects) {
		const attributeId = select.dataset.attributeId;
		if (!attributeId) {
			continue;
		}
		const value = select.value.trim();
		if (value.length > 0) {
			selections[attributeId] = value;
		}
	}
	return selections;
}

function applySkuState(elements: PickerElements, skuId: string | null): void {
	const complete = Boolean(skuId);
	const meta = skuId ? elements.config.skuMetaById[skuId] : undefined;
	const inStock = (meta?.maxPurchasableQuantity ?? 0) > 0;

	if (elements.skuInput) {
		elements.skuInput.value = skuId ?? "";
		elements.skuInput.disabled = !complete;
	}

	if (elements.priceEl && meta) {
		elements.priceEl.textContent = meta.priceLabel;
	}
	if (elements.compareEl) {
		if (meta?.compareLabel) {
			elements.compareEl.textContent = meta.compareLabel;
			elements.compareEl.hidden = false;
		} else {
			elements.compareEl.textContent = "";
			elements.compareEl.hidden = true;
		}
	}
	if (elements.fulfillmentEl) {
		elements.fulfillmentEl.textContent = meta ? `Fulfillment: ${meta.fulfillmentLabel}` : "";
		elements.fulfillmentEl.hidden = !meta;
	}
	if (elements.stockEl) {
		elements.stockEl.textContent = complete
			? (meta?.stockLabel ?? "Out of stock")
			: "Choose all options";
		elements.stockEl.style.color =
			complete && inStock ? "var(--color-muted)" : "var(--color-danger)";
	}
	if (elements.addToCartButton) {
		elements.addToCartButton.disabled = !complete || !inStock;
	}
	if (elements.quantityField) {
		elements.quantityField.hidden = !complete;
	}
	if (elements.quantityInput) {
		const max = complete && inStock ? (meta?.maxPurchasableQuantity ?? 1) : 1;
		elements.quantityInput.max = String(max);
		elements.quantityInput.disabled = !complete || !inStock;
		if (!complete || !inStock) {
			elements.quantityInput.value = "0";
		} else if (Number(elements.quantityInput.value) > max) {
			elements.quantityInput.value = String(Math.max(1, max));
		} else if (Number(elements.quantityInput.value) < 1) {
			elements.quantityInput.value = "1";
		}
	}
	if (elements.mainImage && meta?.imageUrl) {
		elements.mainImage.src = meta.imageUrl;
	} else if (elements.mainImage && elements.heroImageUrl) {
		elements.mainImage.src = elements.heroImageUrl;
	}
}

function refreshFromIndex(elements: PickerElements, changedIndex: number): void {
	const { config, selects } = elements;
	let selections = readSelections(selects, config);

	for (let index = changedIndex + 1; index < selects.length; index += 1) {
		const select = selects[index];
		const attribute = config.attributes[index];
		if (!select || !attribute) {
			continue;
		}
		delete selections[attribute.id];
		const choices = getChoicesForAttributeIndex({
			rows: config.rows,
			attributes: config.attributes,
			selections,
			attributeIndex: index,
			skuMetaById: config.skuMetaById,
		});
		fillSelectOptions(select, attribute.name, choices, "");
		select.disabled = choices.length === 0;
	}

	selections = readSelections(selects, config);
	const skuId = resolveSkuIdFromSelections({
		rows: config.rows,
		attributes: config.attributes,
		selections,
	});
	applySkuState(elements, skuId);
}

function bindPicker(elements: PickerElements): void {
	for (const select of elements.selects) {
		const index = Number(select.dataset.attributeIndex ?? "0");
		select.addEventListener("change", () => {
			refreshFromIndex(elements, index);
		});
	}
}

function renderInitialState(elements: PickerElements): void {
	const { config, selects } = elements;
	const selections: Record<string, string> = {};

	for (let index = 0; index < selects.length; index += 1) {
		const select = selects[index];
		const attribute = config.attributes[index];
		if (!select || !attribute) {
			continue;
		}
		const choices = getChoicesForAttributeIndex({
			rows: config.rows,
			attributes: config.attributes,
			selections,
			attributeIndex: index,
			skuMetaById: config.skuMetaById,
		});
		fillSelectOptions(select, attribute.name, choices, "");
		select.disabled = index > 0;
	}

	applySkuState(elements, null);
}

export function initStorefrontVariantPicker(root: HTMLElement): void {
	const config = parseConfig(root);
	if (!config) {
		return;
	}
	const heroImageUrl = root.dataset.heroImageUrl ?? "";

	const selects = [...root.querySelectorAll<HTMLSelectElement>(OPTION_SELECT)].toSorted(
		(left, right) => {
			return (
				Number(left.dataset.attributeIndex ?? "0") - Number(right.dataset.attributeIndex ?? "0")
			);
		},
	);
	const skuInput = root.querySelector<HTMLInputElement>(SKU_INPUT);
	if (!skuInput || selects.length === 0) {
		return;
	}

	const elements: PickerElements = {
		root,
		config,
		selects,
		skuInput,
		priceEl: document.querySelector(PRICE_EL),
		compareEl: document.querySelector(COMPARE_EL),
		fulfillmentEl: document.querySelector(FULFILLMENT_EL),
		stockEl: document.querySelector(STOCK_EL),
		addToCartButton: document.querySelector(ADD_TO_CART_EL),
		quantityField: document.querySelector(QUANTITY_FIELD_EL),
		quantityInput: document.querySelector(QUANTITY_EL),
		mainImage: document.querySelector(MAIN_IMAGE_EL),
		heroImageUrl,
	};

	renderInitialState(elements);
	bindPicker(elements);
}
