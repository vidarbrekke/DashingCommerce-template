export async function postCommerce<T>(
	apiBase: string,
	route: string,
	body: Record<string, unknown>,
): Promise<T> {
	const response = await fetch(`${apiBase}/${route}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-EmDash-Request": "1",
		},
		body: JSON.stringify(body),
	});
	const raw = await response.json().catch(() => ({}));
	if (!response.ok) {
		const message = typeof raw?.error?.message === "string" ? raw.error.message : "Request failed";
		throw new Error(message);
	}
	const payload = raw && typeof raw === "object" && "data" in raw ? raw.data : raw;
	if (payload?.status === "error") {
		const issue = Array.isArray(payload.issues) ? payload.issues[0] : null;
		throw new Error(issue?.message ?? "Request failed");
	}
	return payload as T;
}
