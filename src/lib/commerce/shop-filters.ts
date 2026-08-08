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

import { createWorkerSafeFetch } from "./client.js";

type CatalogListItem = { id: string; name: string; slug: string };

async function fetchCatalogListItems(
	route: "catalog/brand/list" | "catalog/category/list" | "catalog/tag/list",
	ssrRequestUrl?: string,
): Promise<CatalogListItem[]> {
	const fetchFn =
		typeof window === "undefined" && ssrRequestUrl
			? createWorkerSafeFetch(ssrRequestUrl)
			: fetch;
	const res = await fetchFn(`/_emdash/api/plugins/commerce/${route}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "X-EmDash-Request": "1" },
		body: JSON.stringify({ limit: 200 }),
	});
	if (!res.ok) return [];
	const data = (await res.json()) as { items?: CatalogListItem[] };
	return data.items ?? [];
}

export async function resolveShopFilterLabels(
	filters: {
		brandId?: string;
		categoryId?: string;
		tagId?: string;
	},
	ssrRequestUrl?: string,
): Promise<{ brandName: string | null; categoryName: string | null; tagName: string | null }> {
	const [brands, categories, tags] = await Promise.all([
		filters.brandId ? fetchCatalogListItems("catalog/brand/list", ssrRequestUrl) : Promise.resolve([]),
		filters.categoryId
			? fetchCatalogListItems("catalog/category/list", ssrRequestUrl)
			: Promise.resolve([]),
		filters.tagId ? fetchCatalogListItems("catalog/tag/list", ssrRequestUrl) : Promise.resolve([]),
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
