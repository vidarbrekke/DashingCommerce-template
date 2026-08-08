import type { StorefrontCommerceClient } from "@emdash-cms/plugin-dashing-commerce/contracts/phase-1-clients";

export function shopListUrl(params: {
	brandId?: string;
	categoryId?: string;
	tagId?: string;
}): string {
	const search = new URLSearchParams();
	if (params.brandId) search.set("brand", params.brandId);
	if (params.categoryId) search.set("category", params.categoryId);
	if (params.tagId) search.set("tag", params.tagId);
	const query = search.toString();
	return query ? `/shop?${query}` : "/shop";
}

export function shopBrandUrl(brandId: string): string {
	return shopListUrl({ brandId });
}

export function shopCategoryUrl(categoryId: string): string {
	return shopListUrl({ categoryId });
}

export function shopTagUrl(tagId: string): string {
	return shopListUrl({ tagId });
}

const FILTER_LIST_LIMIT = 100;

export async function resolveShopFilterLabels(
	client: StorefrontCommerceClient,
	filters: {
		brandId?: string;
		categoryId?: string;
		tagId?: string;
	},
): Promise<{ brandName: string | null; categoryName: string | null; tagName: string | null }> {
	const [brands, categories, tags] = await Promise.all([
		filters.brandId
			? client.listBrands({ limit: FILTER_LIST_LIMIT }).then((r) => r.items)
			: Promise.resolve([]),
		filters.categoryId
			? client.listCategories({ limit: FILTER_LIST_LIMIT }).then((r) => r.items)
			: Promise.resolve([]),
		filters.tagId
			? client.listTags({ limit: FILTER_LIST_LIMIT }).then((r) => r.items)
			: Promise.resolve([]),
	]);
	return {
		brandName: filters.brandId
			? (brands.find((item) => item.id === filters.brandId)?.name ?? null)
			: null,
		categoryName: filters.categoryId
			? (categories.find((item) => item.id === filters.categoryId)?.name ?? null)
			: null,
		tagName: filters.tagId ? (tags.find((item) => item.id === filters.tagId)?.name ?? null) : null,
	};
}
