import { describe, expect, it } from "vitest";

import { buildStatusHref } from "./order-status.ts";

describe("order status href helper", () => {
	it("uses payment attempt id when provided", () => {
		expect(buildStatusHref("ord_1", "att_123")).toBe(
			"/shop/status?orderId=ord_1&paymentAttemptId=att_123",
		);
		expect(buildStatusHref("ord_1", "att_123", "paypal")).toBe(
			"/shop/status?orderId=ord_1&paymentAttemptId=att_123&providerId=paypal",
		);
		expect(buildStatusHref("ord_1", "att_123", "  paypal  ")).toBe(
			"/shop/status?orderId=ord_1&paymentAttemptId=att_123&providerId=paypal",
		);
	});

	it("omits paymentAttemptId when missing or blank", () => {
		expect(buildStatusHref("ord_1")).toBe("/shop/status?orderId=ord_1");
		expect(buildStatusHref("ord_2", "", "paypal")).toBe(
			"/shop/status?orderId=ord_2&providerId=paypal",
		);
		expect(buildStatusHref("ord_3", "   ", "  ")).toBe("/shop/status?orderId=ord_3");
	});

	it("builds status URL with order id only when attempt absent", () => {
		const legacyHref = buildStatusHref("ord_legacy", undefined);
		expect(legacyHref).toBe("/shop/status?orderId=ord_legacy");
		const legacyNoProviderParam = new URL(`https://example.test${legacyHref}`);
		expect(legacyNoProviderParam.searchParams.has("providerId")).toBe(false);
		expect(legacyNoProviderParam.searchParams.has("paymentAttemptId")).toBe(false);
	});

	it("includes finalize token when provided", () => {
		const href = buildStatusHref("ord_1", "att_123", "stripe", "  token_abc  ");
		expect(href).toBe(
			"/shop/status?orderId=ord_1&paymentAttemptId=att_123&providerId=stripe&finalizeToken=token_abc",
		);
	});

	it("includes externalEventId when webhook event id provided", () => {
		const href = buildStatusHref("ord_1", "att_123", "stripe", "tok", "evt_live_xyz");
		expect(href).toContain("externalEventId=evt_live_xyz");
		expect(href).toContain("paymentAttemptId=att_123");
	});
});
