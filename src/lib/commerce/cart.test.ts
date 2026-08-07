import { describe, expect, it } from "vitest";

import {
	CART_ID_COOKIE,
	OWNER_TOKEN_COOKIE,
	formatCustomerOrderReference,
	resolveCartSessionForUpsert,
	resolveOwnerTokenFromCookie,
} from "./cart";

function requestWithCookies(cookie: string): Request {
	return new Request("https://localhost", {
		headers: {
			cookie,
		},
	});
}

describe("owner token validation", () => {
	it("accepts valid long owner token", () => {
		const token = "a".repeat(20);
		expect(resolveOwnerTokenFromCookie(token)).toBe(token);
	});

	it("trims whitespace around token", () => {
		const token = `${"b".repeat(16)} `;
		expect(resolveOwnerTokenFromCookie(token)).toBe("b".repeat(16));
	});

	it("rejects short owner token", () => {
		expect(resolveOwnerTokenFromCookie("short")).toBeUndefined();
	});
});

describe("cart/session resolver for upsert", () => {
	it("keeps valid cart + owner token", () => {
		const token = "b".repeat(20);
		const request = requestWithCookies(
			`${OWNER_TOKEN_COOKIE}=${token}; ${CART_ID_COOKIE}=cart_old`,
		);
		const session = resolveCartSessionForUpsert(request);

		expect(session.cartId).toBe("cart_old");
		expect(session.ownerToken).toBe(token);
	});

	it("starts new cart when owner token missing", () => {
		const request = requestWithCookies(`${CART_ID_COOKIE}=cart_old`);
		const session = resolveCartSessionForUpsert(request);

		expect(session.cartId).not.toBe("cart_old");
		expect(session.ownerToken).toBeUndefined();
	});

	it("starts new cart when owner token invalid", () => {
		const request = requestWithCookies(`${CART_ID_COOKIE}=cart_old; ${OWNER_TOKEN_COOKIE}=short`);
		const session = resolveCartSessionForUpsert(request);

		expect(session.cartId).not.toBe("cart_old");
		expect(session.ownerToken).toBeUndefined();
	});

	it("starts new cart when cart id cookie is empty", () => {
		const request = requestWithCookies(`${CART_ID_COOKIE}=`);
		const session = resolveCartSessionForUpsert(request);

		expect(session.cartId.length).toBeGreaterThan(0);
		expect(session.cartId).toMatch(/^cart_/);
		expect(session.ownerToken).toBeUndefined();
	});
});

describe("formatCustomerOrderReference", () => {
	it("shows last 8 of checkout-order hash", () => {
		expect(
			formatCustomerOrderReference(
				"checkout-order:b6198470d0c55a997777379833b10717e378c7339c974f6582e747c5b80199da",
			),
		).toBe("B80199DA");
	});

	it("handles bare ids", () => {
		expect(formatCustomerOrderReference("ord_abcdefgh")).toBe("ABCDEFGH");
	});
});
