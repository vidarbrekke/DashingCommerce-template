/**
 * Cart state helpers — cookie-based, no external session store.
 *
 * cartId      — stable per browser, generated on first upsert
 * ownerToken  — returned by cart/upsert on first creation
 */

import { formatMinorMoney } from "@emdash-cms/plugin-dashing-commerce/money";

export const CART_ID_COOKIE = "dc_cart_id";
export const OWNER_TOKEN_COOKIE = "dc_owner_token";
export const FINALIZE_TOKEN_PARAM = "finalizeToken";
export const ORDER_ID_PARAM = "orderId";

/** Commerce plugin requires owner tokens at least this long (matches Zod). */
const MIN_OWNER_TOKEN_LEN = 16;
const UUID_HYPHENS = /-/g;

/**
 * Return cookie value only if it satisfies plugin `ownerToken` length rules.
 * Prevents sending junk/legacy short values that fail validation or confuse sessions.
 */
export function resolveOwnerTokenFromCookie(raw: string | undefined): string | undefined {
	const t = raw?.trim();
	if (!t || t.length < MIN_OWNER_TOKEN_LEN) {
		return undefined;
	}
	return t;
}

/** Treat blank cookie values as absent (avoids sending cartId: "" to cart/upsert). */
export function normalizeCartId(raw: string | undefined): string | undefined {
	const t = raw?.trim();
	return t && t.length > 0 ? t : undefined;
}

/**
 * Resolves cart id + optional owner token for `cart/upsert`.
 * If browser still has `dc_cart_id` but owner token is missing or invalid, starts a
 * fresh cart id so the server does not treat the request as a mutation on an
 * existing cart (which would require a valid owner proof).
 */
export function resolveCartSessionForUpsert(request: Request): {
	cartId: string;
	ownerToken?: string;
} {
	const owner = resolveOwnerTokenFromCookie(readCookie(request, OWNER_TOKEN_COOKIE));
	const cartId = normalizeCartId(readCookie(request, CART_ID_COOKIE));
	if (cartId && !owner) {
		return { cartId: newCartId(), ownerToken: undefined };
	}
	return { cartId: cartId ?? newCartId(), ownerToken: owner };
}

/** Read a cookie value from an Astro request. */
export function readCookie(request: Request, name: string): string | undefined {
	const header = request.headers.get("cookie") ?? "";
	for (const part of header.split(";")) {
		const [k, ...rest] = part.trim().split("=");
		if (k?.trim() === name) {
			return decodeURIComponent(rest.join("=").trim());
		}
	}
	return undefined;
}

/** Build a Set-Cookie header value (SameSite=Lax, HttpOnly, 30-day expiry). */
export function cookieHeader(name: string, value: string): string {
	const maxAge = 60 * 60 * 24 * 30;
	return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; HttpOnly`;
}

/** Generate a random cart ID. */
export function newCartId(): string {
	const rand =
		typeof crypto !== "undefined" && crypto.randomUUID
			? crypto.randomUUID().replace(UUID_HYPHENS, "").slice(0, 16)
			: Math.random().toString(36).slice(2, 18);
	return `cart_${rand}`;
}

/** Generate a random idempotency key (≥16 chars). */
export function newIdempotencyKey(): string {
	const rand =
		typeof crypto !== "undefined" && crypto.randomUUID
			? crypto.randomUUID().replace(UUID_HYPHENS, "")
			: `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
	return rand.slice(0, 24);
}

/** Format a minor-unit price for storefront display (currency-aware). */
export function formatPrice(minor: number, currency = "USD"): string {
	return formatMinorMoney(minor, currency);
}

/**
 * Short customer-facing order reference from the internal deterministic id.
 * Full `checkout-order:…` ids stay in URLs/admin for correlation; shoppers see a short code.
 */
export function formatCustomerOrderReference(orderId: string): string {
	const trimmed = orderId.trim();
	const hash = trimmed.includes(":") ? (trimmed.split(":").pop() ?? trimmed) : trimmed;
	const short = hash.slice(-8).toUpperCase();
	return short.length > 0 ? short : trimmed;
}
