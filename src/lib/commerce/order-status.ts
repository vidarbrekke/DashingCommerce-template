export function buildStatusHref(
	orderId: string,
	paymentAttemptId?: string | null,
	providerId?: string | null,
	finalizeToken?: string | null,
	webhookExternalEventId?: string | null,
): string {
	const normalizedOrderId = orderId.trim();
	const normalizedAttemptId =
		typeof paymentAttemptId === "string" && paymentAttemptId.trim().length > 0
			? paymentAttemptId.trim()
			: "";
	const normalizedProviderId = typeof providerId === "string" ? providerId.trim() : "";
	const normalizedFinalizeToken = typeof finalizeToken === "string" ? finalizeToken.trim() : "";
	const normalizedWebhookEvent =
		typeof webhookExternalEventId === "string" && webhookExternalEventId.trim().length > 0
			? webhookExternalEventId.trim()
			: "";

	const params = new URLSearchParams({
		orderId: normalizedOrderId,
	});
	if (normalizedAttemptId.length > 0) {
		params.set("paymentAttemptId", normalizedAttemptId);
	}
	if (normalizedProviderId.length > 0) {
		params.set("providerId", normalizedProviderId);
	}
	if (normalizedFinalizeToken.length > 0) {
		params.set("finalizeToken", normalizedFinalizeToken);
	}
	if (normalizedWebhookEvent.length > 0) {
		params.set("externalEventId", normalizedWebhookEvent);
	}

	return `/shop/status?${params.toString()}`;
}
