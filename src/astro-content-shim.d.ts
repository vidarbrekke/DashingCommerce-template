/**
 * Temporary shim for environments where astro content virtual module
 * lacks declaration file during TypeScript checks.
 */
declare module "astro:content" {
	export type ContentCollectionConfig = Record<string, unknown>;

	export function defineLiveCollection<T extends Record<string, unknown>>(config: T): T;
	export function defineCollection<T extends ContentCollectionConfig>(config: T): T;
}
