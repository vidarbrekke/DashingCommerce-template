import type { StorefrontCommerceClient } from "@emdash-cms/plugin-dashing-commerce/contracts/phase-1-clients";
import { PhaseOneCommerceError } from "@emdash-cms/plugin-dashing-commerce/contracts/phase-1-clients";

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

async function resolveLabel(
	load: () => Promise<string | null | undefined>,
): Promise<string | null> {
	try {
		return (await load()) ?? null;
	} catch (err) {
		if (err instanceof PhaseOneCommerceError && err.status === 404) {
			return null;
		}
		throw err;
	}
}

export async function resolveShopFilterLabels(
	client: StorefrontCommerceClient,
	filters: {
		brandId?: string;
		categoryId?: string;
		tagId?: string;
	},
): Promise<{ brandName: string | null; categoryName: string | null; tagName: string | null }> {
	const [brandName, categoryName, tagName] = await Promise.all([
		filters.brandId
			? resolveLabel(async () => {
					const result = await client.getBrand({ brandId: filters.brandId! });
					return result.term.name;
				})
			: Promise.resolve(null),
		filters.categoryId
			? resolveLabel(async () => {
					const result = await client.getCategory({ categoryId: filters.categoryId! });
					return result.category.name;
				})
			: Promise.resolve(null),
		filters.tagId
			? resolveLabel(async () => {
					const result = await client.getTag({ tagId: filters.tagId! });
					return result.tag.name;
				})
			: Promise.resolve(null),
	]);
	return { brandName, categoryName, tagName };
}
