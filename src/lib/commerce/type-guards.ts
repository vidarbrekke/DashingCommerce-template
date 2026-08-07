/** Plain object (not array, not null). For JSON/wire `unknown` boundaries. */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
