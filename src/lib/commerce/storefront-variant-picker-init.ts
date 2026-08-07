import { initStorefrontVariantPicker } from "./storefront-variant-picker-dom.js";

const pickerRoot = document.querySelector("[data-variant-picker]");
if (pickerRoot instanceof HTMLElement) {
	initStorefrontVariantPicker(pickerRoot);
}
