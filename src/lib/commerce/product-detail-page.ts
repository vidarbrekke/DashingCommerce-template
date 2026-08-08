import type { StorefrontProductBySlugResponseContract } from "@emdash-cms/plugin-dashing-commerce/contracts/route-response-contracts";
import { PhaseOneCommerceError } from "@emdash-cms/plugin-dashing-commerce/contracts/phase-1-clients";
import {
	MEDIA_STORE_GALLERY_THUMB_WIDTH,
	MEDIA_STORE_HERO_WIDTH,
	getMediaRenditionUrl,
} from "@emdash-cms/plugin-dashing-commerce/media-rendition";
import type { PublicPluginRuntimeLocals } from "emdash/plugin-utils";

import { buildShopClient } from "./client.js";
import {
	cookieHeader,
	formatPrice,
	newCartId,
	resolveCartSessionForUpsert,
	CART_ID_COOKIE,
	OWNER_TOKEN_COOKIE,
} from "./cart.js";
import {
	buildStorefrontVariantPickerConfig,
	resolveVariantPickerMode,
	type StorefrontVariantPickerConfig,
} from "./storefront-variant-picker.js";

type DetailSku = NonNullable<StorefrontProductBySlugResponseContract["skus"]>[number];

export interface SkuStockState {
	label: string;
	max: number;
}

export interface ProductDetailView {
	detail: StorefrontProductBySlugResponseContract;
	fetchError: null;
	cartError: string | null;
	storefrontPriceLine: string;
	storefrontCompareLine: number | null;
	heroDisplayUrl: string;
	heroImageAlt: string;
	galleryImages: NonNullable<StorefrontProductBySlugResponseContract["galleryImages"]>;
	galleryMainSrc: (originalUrl: string) => string;
	galleryThumbSrc: (originalUrl: string) => string;
	variantImageBySkuRecord: Record<string, string>;
	selectedSkuForPage: DetailSku | null;
	selectedSkuIdForPage: string;
	selectedSkuPriceLabel: string;
	selectedSkuCompareLabel: string | null;
	showLivePrice: boolean;
	useCascadingVariantPicker: boolean;
	variantPickerConfig: StorefrontVariantPickerConfig | null;
	describeSkuFulfillment: (sku: DetailSku) => string;
	selectedSkuFulfillment: string;
	selectedStockLabel: string;
	selectedMaxQty: number;
	isAddDisabled: boolean;
	defaultOrderQuantityMax: number;
	showQuantityField: boolean;
	stockStateBySkuRecord: Record<string, SkuStockState>;
}

export interface ProductDetailErrorView {
	detail: null;
	fetchError: string;
}

export type ProductDetailPageModel = ProductDetailView | ProductDetailErrorView;

export function isProductDetailView(model: ProductDetailPageModel): model is ProductDetailView {
	return model.detail !== null;
}

function describeSkuFulfillment(sku: DetailSku): string {
	if (sku.isDigital) return "Digital download";
	if (sku.requiresShipping) return "Ships to you";
	return "Delivery details on file";
}

export async function loadProductDetailPage(
	request: Request,
	slug: string,
	siteOrigin: string,
	locals?: PublicPluginRuntimeLocals | null,
): Promise<Response | ProductDetailPageModel> {
	const client = buildShopClient(siteOrigin, request.url, locals);

	let detail: StorefrontProductBySlugResponseContract | null = null;
	let fetchError: string | null = null;
	let cartError: string | null = null;
	let selectedSkuForPage: DetailSku | null = null;
	let selectedSkuIdForPage = "";

	try {
		detail = await client.getProductBySlug({ slug });
	} catch (err) {
		fetchError = err instanceof Error ? err.message : "Product not found";
	}

	if (fetchError || !detail) {
		return { detail: null, fetchError: fetchError ?? "Product not found" };
	}

	let storefrontPriceLine = "";
	let storefrontCompareLine: number | null = null;
	const displayPrice = detail.displayPrice;
	if (displayPrice) {
		if (displayPrice.minUnitPriceMinor === displayPrice.maxUnitPriceMinor) {
			storefrontPriceLine = formatPrice(displayPrice.minUnitPriceMinor);
			storefrontCompareLine = displayPrice.compareAtPriceMinor ?? null;
		} else {
			storefrontPriceLine = `${formatPrice(displayPrice.minUnitPriceMinor)} – ${formatPrice(displayPrice.maxUnitPriceMinor)}`;
		}
	}

	const galleryImages = detail.galleryImages ?? [];
	const heroImageUrl = detail.heroImageUrl ?? "";
	const heroDisplayUrl = heroImageUrl
		? getMediaRenditionUrl(heroImageUrl, { width: MEDIA_STORE_HERO_WIDTH, siteOrigin })
		: "";
	const variantImageBySkuRecord: Record<string, string> = {};
	for (const row of detail.variantMatrix ?? []) {
		const url = row.image?.externalAssetId;
		if (typeof row.skuId === "string" && typeof url === "string" && url.length > 0) {
			variantImageBySkuRecord[row.skuId] = getMediaRenditionUrl(url, {
				width: MEDIA_STORE_HERO_WIDTH,
				siteOrigin,
			});
		}
	}
	const heroImageAlt = detail.primaryImage?.altText ?? detail.product.title ?? "Product image";

	const galleryMainSrc = (originalUrl: string) =>
		getMediaRenditionUrl(originalUrl, { width: MEDIA_STORE_HERO_WIDTH, siteOrigin });
	const galleryThumbSrc = (originalUrl: string) =>
		getMediaRenditionUrl(originalUrl, {
			width: MEDIA_STORE_GALLERY_THUMB_WIDTH,
			siteOrigin,
		});

	if (request.method === "POST") {
		const formData = await request.formData();
		const skuId = formData.get("skuId")?.toString() ?? "";
		const parsedQuantity = Number(formData.get("quantity") ?? 1);
		const quantity =
			Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? Math.floor(parsedQuantity) : 1;

		const matchedSku = skuId ? detail.skus?.find((s) => s.id === skuId) : undefined;
		selectedSkuForPage = matchedSku ?? null;
		selectedSkuIdForPage = matchedSku?.id ?? "";

		if (!matchedSku) {
			cartError = skuId
				? "No SKU available for this product."
				: "Choose all options before adding to cart.";
		} else {
			const maxPurchasable = matchedSku.maxPurchasableQuantity ?? 0;
			const clampedQuantity = Math.min(quantity, maxPurchasable);
			if (maxPurchasable <= 0) {
				cartError = matchedSku.stockLabel;
			} else if (quantity > maxPurchasable) {
				cartError = `Only ${maxPurchasable} available (${matchedSku.stockLabel}).`;
			} else {
				const { cartId, ownerToken: existingOwnerToken } = resolveCartSessionForUpsert(request);
				const lineItems = [
					{
						productId: detail.product.id,
						variantId: matchedSku.id,
						quantity: clampedQuantity,
						inventoryVersion: matchedSku.inventoryVersion ?? 0,
						unitPriceMinor: matchedSku.unitPriceMinor ?? 0,
					},
				];

				try {
					let upsert;
					try {
						upsert = await client.upsertCart({
							cartId,
							ownerToken: existingOwnerToken,
							upsertMode: "append",
							lineItems,
						});
					} catch (err) {
						const staleSession =
							err instanceof PhaseOneCommerceError &&
							(err.code === "cart_expired" || err.code === "cart_token_invalid");
						if (!staleSession) {
							throw err;
						}
						upsert = await client.upsertCart({
							cartId: newCartId(),
							upsertMode: "append",
							lineItems,
						});
					}

					const headers = new Headers({ Location: "/shop/cart" });
					headers.append("Set-Cookie", cookieHeader(CART_ID_COOKIE, upsert.cartId));
					if (upsert.ownerToken) {
						headers.append("Set-Cookie", cookieHeader(OWNER_TOKEN_COOKIE, upsert.ownerToken));
					}
					return new Response(null, { status: 303, headers });
				} catch (err) {
					if (err instanceof PhaseOneCommerceError) {
						cartError = err.message;
					} else {
						cartError = err instanceof Error ? err.message : "Failed to add to cart";
					}
				}
			}
		}
	}

	const variantPickerMode = resolveVariantPickerMode(detail);
	const variantPickerConfig =
		variantPickerMode === "cascading"
			? buildStorefrontVariantPickerConfig({
					detail,
					describeFulfillment: describeSkuFulfillment,
				})
			: null;
	if (variantPickerConfig) {
		for (const meta of Object.values(variantPickerConfig.skuMetaById)) {
			if (meta.imageUrl) {
				meta.imageUrl = getMediaRenditionUrl(meta.imageUrl, {
					width: MEDIA_STORE_HERO_WIDTH,
					siteOrigin,
				});
			}
		}
	}
	const useCascadingVariantPicker = variantPickerConfig !== null;

	if (!selectedSkuForPage && detail.skus?.length) {
		if (useCascadingVariantPicker && variantPickerConfig) {
			selectedSkuForPage =
				detail.skus.find((sku) => sku.id === variantPickerConfig.defaultSkuId) ??
				detail.skus.find((sku) => sku.status === "active") ??
				detail.skus[0] ??
				null;
		} else {
			selectedSkuForPage = detail.skus.find((s) => s.status === "active") ?? detail.skus[0] ?? null;
		}
		selectedSkuIdForPage = selectedSkuForPage?.id ?? "";
	}

	const selectedSkuPriceLabel = selectedSkuForPage
		? formatPrice(selectedSkuForPage.unitPriceMinor)
		: storefrontPriceLine;
	const selectedSkuCompareLabel =
		selectedSkuForPage?.compareAtPriceMinor !== undefined &&
		selectedSkuForPage.compareAtPriceMinor > selectedSkuForPage.unitPriceMinor
			? formatPrice(selectedSkuForPage.compareAtPriceMinor)
			: null;
	const showLivePrice = useCascadingVariantPicker && Boolean(selectedSkuForPage);

	const stockStateBySkuRecord: Record<string, SkuStockState> = {};
	for (const sku of detail.skus ?? []) {
		stockStateBySkuRecord[sku.id] = {
			label: sku.stockLabel,
			max: sku.maxPurchasableQuantity,
		};
	}
	const selectedStockLabel = selectedSkuForPage?.stockLabel ?? "Out of stock";
	const selectedMaxQty = selectedSkuForPage?.maxPurchasableQuantity ?? 0;
	const isAddDisabled = useCascadingVariantPicker
		? true
		: !selectedSkuForPage || selectedMaxQty <= 0;
	const defaultOrderQuantityMax = selectedMaxQty > 0 ? selectedMaxQty : 1;
	const selectedSkuFulfillment = selectedSkuForPage ? describeSkuFulfillment(selectedSkuForPage) : "";
	const showQuantityField = !useCascadingVariantPicker;

	return {
		detail,
		fetchError: null,
		cartError,
		storefrontPriceLine,
		storefrontCompareLine,
		heroDisplayUrl,
		heroImageAlt,
		galleryImages,
		galleryMainSrc,
		galleryThumbSrc,
		variantImageBySkuRecord,
		selectedSkuForPage,
		selectedSkuIdForPage,
		selectedSkuPriceLabel,
		selectedSkuCompareLabel,
		showLivePrice,
		useCascadingVariantPicker,
		variantPickerConfig,
		describeSkuFulfillment,
		selectedSkuFulfillment,
		selectedStockLabel,
		selectedMaxQty,
		isAddDisabled,
		defaultOrderQuantityMax,
		showQuantityField,
		stockStateBySkuRecord,
	};
}
