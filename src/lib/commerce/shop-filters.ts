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

type CatalogListItem = { id: string; name: string; slug: string };

async function fetchCatalogListItems(
	origin: string,
	route: "catalog/brand/list" | "catalog/category/list" | "catalog/tag/list",
): Promise<CatalogListItem[]> {
	const res = await fetch(`${origin}/_emdash/api/plugins/commerce/${route}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "X-EmDash-Request": "1" },
		body: JSON.stringify({ limit: 200 }),
	});
	if (!res.ok) return [];
	const data = (await res.json()) as { items?: CatalogListItem[] };
	return data.items ?? [];
}

export async function resolveShopFilterLabels(
	origin: string,
	filters: { brandId?: string; categoryId?: string; tagId?: string },
): Promise<{ brandName: string | null; categoryName: string | null; tagName: string | null }> {
	const [brands, categories, tags] = await Promise.all([
		filters.brandId ? fetchCatalogListItems(origin, "catalog/brand/list") : Promise.resolve([]),
		filters.categoryId
			? fetchCatalogListItems(origin, "catalog/category/list")
			: Promise.resolve([]),
		filters.tagId ? fetchCatalogListItems(origin, "catalog/tag/list") : Promise.resolve([]),
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
