import ProductLayoutClassic from "../../components/commerce/ProductLayoutClassic.astro";
import ProductLayoutStacked from "../../components/commerce/ProductLayoutStacked.astro";
import type { ProductLayoutId } from "./storefront-appearance.js";

export const productLayouts = {
	classic: ProductLayoutClassic,
	stacked: ProductLayoutStacked,
} satisfies Record<ProductLayoutId, typeof ProductLayoutClassic>;

export function getProductLayout(layoutId: ProductLayoutId): typeof ProductLayoutClassic {
	return productLayouts[layoutId] ?? productLayouts.classic;
}
