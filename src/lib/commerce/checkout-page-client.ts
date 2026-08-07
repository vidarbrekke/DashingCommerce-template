import { formatPrice, newIdempotencyKey } from "./cart.ts";
import { orderNeedsShipping, orderNeedsTax, type CheckoutOrder } from "./checkout-order-helpers.ts";
import { postCommerce } from "./commerce-fetch.ts";
import { buildStatusHref } from "./order-status.ts";

export type CheckoutSummaryLine = {
	key: string;
	title: string;
	subtitle: string | null;
	quantity: number;
	lineTotalMinor: number;
	imageSrc: string | null;
	imageAlt: string;
};

export type CheckoutBootstrap = {
	commerceApiBase: string;
	statusPath: string;
	currency: string;
	cartId: string;
	ownerToken: string;
	requiresShipping: boolean;
	lineItems: CheckoutSummaryLine[];
	orderId?: string;
	finalizeToken?: string;
	initialSubtotalMinor: number;
};

type OrderWire = CheckoutOrder;

function readyToPay(order: OrderWire): boolean {
	return !orderNeedsShipping(order) && !orderNeedsTax(order);
}

type ShippingRate = {
	providerId: string;
	rateId: string;
	label: string;
	amountMinor: number;
	currency: string;
};

declare global {
	interface Window {
		Stripe?: (key: string) => StripeInstance;
	}
}

type StripeInstance = {
	elements: (opts: {
		clientSecret: string;
		appearance?: Record<string, unknown>;
	}) => StripeElements;
	confirmPayment: (opts: {
		elements: StripeElements;
		confirmParams: { return_url: string };
		redirect: "if_required";
	}) => Promise<{ error?: { message?: string } }>;
};

type StripePaymentElement = {
	mount: (sel: string) => void;
	on: (event: "change", handler: (event: StripePaymentElementChangeEvent) => void) => void;
};

type StripePaymentElementChangeEvent = {
	value: { type?: string };
};

type StripeElements = {
	create: (type: string) => StripePaymentElement;
	fetchUpdates: () => Promise<void>;
};

function isBankIncentivePaymentMethod(type: string | undefined): boolean {
	return type === "us_bank_account";
}

export function initCheckoutPage(bootstrap: CheckoutBootstrap): void {
	const api = bootstrap.commerceApiBase;
	let orderId = bootstrap.orderId ?? "";
	let finalizeToken = bootstrap.finalizeToken ?? "";
	let currentOrder: OrderWire | null = null;
	let shippingRates: ShippingRate[] = [];
	let taxProviderId: string | null = null;
	let stripeMounted = false;
	let stripeElements: StripeElements | null = null;
	let stripeClient: StripeInstance | null = null;
	let paymentAttemptId = "";
	let bankPaymentIncentivePercent = 0;
	let bankIncentiveSyncTimer: ReturnType<typeof setTimeout> | undefined;
	let paymentBusy = false;

	const els = {
		formError: document.getElementById("checkout-form-error"),
		shippingOptions: document.getElementById("checkout-shipping-options"),
		shippingPlaceholder: document.getElementById("checkout-shipping-placeholder"),
		paymentSection: document.getElementById("checkout-payment-section"),
		paymentMount: document.getElementById("stripe-payment-element"),
		paymentError: document.getElementById("checkout-payment-error"),
		paymentHint: document.getElementById("checkout-payment-hint"),
		placeOrder: document.getElementById("checkout-place-order") as HTMLButtonElement | null,
		summaryShipping: document.getElementById("checkout-summary-shipping"),
		summaryTax: document.getElementById("checkout-summary-tax"),
		summaryTotal: document.getElementById("checkout-summary-total"),
		summarySubtotal: document.getElementById("checkout-summary-subtotal"),
	};

	const fields = {
		email: document.getElementById("checkout-email") as HTMLInputElement | null,
		firstName: document.getElementById("checkout-first-name") as HTMLInputElement | null,
		lastName: document.getElementById("checkout-last-name") as HTMLInputElement | null,
		address1: document.getElementById("checkout-address1") as HTMLInputElement | null,
		address2: document.getElementById("checkout-address2") as HTMLInputElement | null,
		city: document.getElementById("checkout-city") as HTMLInputElement | null,
		region: document.getElementById("checkout-region") as HTMLSelectElement | null,
		postalCode: document.getElementById("checkout-postal") as HTMLInputElement | null,
		phone: document.getElementById("checkout-phone") as HTMLInputElement | null,
		country: document.getElementById("checkout-country") as HTMLSelectElement | null,
		billingSame: document.getElementById("checkout-billing-same") as HTMLInputElement | null,
		billingAddress: document.getElementById("checkout-billing-address"),
		billingAddress1: document.getElementById(
			"checkout-billing-address1",
		) as HTMLInputElement | null,
		billingAddress2: document.getElementById(
			"checkout-billing-address2",
		) as HTMLInputElement | null,
		billingCity: document.getElementById("checkout-billing-city") as HTMLInputElement | null,
		billingRegion: document.getElementById("checkout-billing-region") as HTMLSelectElement | null,
		billingPostalCode: document.getElementById(
			"checkout-billing-postal",
		) as HTMLInputElement | null,
		billingCountry: document.getElementById("checkout-billing-country") as HTMLSelectElement | null,
	};

	function showError(message: string | null) {
		if (!els.formError) return;
		if (!message) {
			els.formError.hidden = true;
			els.formError.textContent = "";
			return;
		}
		els.formError.hidden = false;
		els.formError.textContent = message;
	}

	function showPaymentError(message: string | null) {
		if (!els.paymentError) return;
		if (!message) {
			els.paymentError.hidden = true;
			els.paymentError.textContent = "";
			return;
		}
		els.paymentError.hidden = false;
		els.paymentError.textContent = message;
	}

	function emailValid(): boolean {
		const v = fields.email?.value.trim() ?? "";
		return v.length > 3 && v.includes("@");
	}

	function buildContactName(): string | undefined {
		const first = fields.firstName?.value.trim() ?? "";
		const last = fields.lastName?.value.trim() ?? "";
		if (!first && !last) return undefined;
		return [first, last].filter(Boolean).join(" ");
	}

	function addressComplete(): boolean {
		if (!emailValid()) return false;
		return Boolean(
			fields.firstName?.value.trim() &&
			fields.lastName?.value.trim() &&
			fields.address1?.value.trim() &&
			fields.city?.value.trim() &&
			fields.region?.value &&
			fields.postalCode?.value.trim() &&
			fields.phone?.value.trim() &&
			fields.country?.value,
		);
	}

	function syncUrl() {
		if (!orderId || !finalizeToken) return;
		const url = new URL(window.location.href);
		url.searchParams.set("orderId", orderId);
		url.searchParams.set("finalizeToken", finalizeToken);
		window.history.replaceState({}, "", url.toString());
	}

	function updateSummary(order: OrderWire) {
		const currency = order.currency || bootstrap.currency;
		const subtotal = order.subtotalMinor ?? bootstrap.initialSubtotalMinor;
		if (els.summarySubtotal) {
			els.summarySubtotal.textContent = formatPrice(subtotal, currency);
		}
		if (els.summaryShipping) {
			const shipping = order.shippingMinor ?? 0;
			if (order.appliedShipping || shipping > 0) {
				els.summaryShipping.textContent = formatPrice(shipping, currency);
			} else if (bootstrap.requiresShipping) {
				els.summaryShipping.textContent = "Enter address to calculate";
			} else {
				els.summaryShipping.textContent = "—";
			}
		}
		if (els.summaryTax) {
			const tax = order.taxMinor ?? 0;
			if (order.appliedTax || tax > 0) {
				els.summaryTax.textContent = formatPrice(tax, currency);
			} else {
				els.summaryTax.textContent = "Calculated at checkout";
			}
		}
		if (els.summaryTotal) {
			els.summaryTotal.textContent = formatPrice(order.totalMinor, currency);
		}
		if (els.placeOrder) {
			els.placeOrder.textContent = `Place order · ${formatPrice(order.totalMinor, currency)}`;
		}
	}

	async function loadOrder(): Promise<OrderWire> {
		const res = await postCommerce<{ order: OrderWire }>(api, "checkout/get-order", {
			orderId,
			finalizeToken,
		});
		currentOrder = res.order;
		updateSummary(currentOrder);
		return currentOrder;
	}

	async function ensureOrder(): Promise<void> {
		if (orderId && finalizeToken) {
			await loadOrder();
			return;
		}
		const billingSame = fields.billingSame?.checked;

		const checkoutPayload: Record<string, string | boolean | undefined> = {
			cartId: bootstrap.cartId,
			ownerToken: bootstrap.ownerToken,
			idempotencyKey: newIdempotencyKey(),
			email: fields.email?.value.trim() || undefined,
			contactName: buildContactName(),
			contactPhone: fields.phone?.value.trim() || undefined,
			shippingAddress1: fields.address1?.value.trim() || undefined,
			shippingAddress2: fields.address2?.value.trim() || undefined,
			shippingCity: fields.city?.value.trim() || undefined,
			shippingRegion: fields.region?.value || undefined,
			shippingPostalCode: fields.postalCode?.value.trim() || undefined,
			shippingCountry: fields.country?.value || undefined,
			billingSameAsShipping: billingSame || undefined,
		};

		if (!billingSame) {
			checkoutPayload.billingAddress1 = fields.billingAddress1?.value.trim() || undefined;
			checkoutPayload.billingAddress2 = fields.billingAddress2?.value.trim() || undefined;
			checkoutPayload.billingCity = fields.billingCity?.value.trim() || undefined;
			checkoutPayload.billingRegion = fields.billingRegion?.value || undefined;
			checkoutPayload.billingPostalCode = fields.billingPostalCode?.value.trim() || undefined;
			checkoutPayload.billingCountry = fields.billingCountry?.value || undefined;
		}

		const res = await postCommerce<{ orderId: string; finalizeToken: string }>(
			api,
			"checkout",
			checkoutPayload,
		);
		orderId = res.orderId;
		finalizeToken = res.finalizeToken;
		syncUrl();
		await loadOrder();
	}

	function renderShippingRates(rates: ShippingRate[]) {
		if (!els.shippingOptions || !els.shippingPlaceholder) return;
		if (rates.length === 0) {
			els.shippingPlaceholder.hidden = false;
			els.shippingPlaceholder.textContent = "No shipping rates available for this order.";
			els.shippingOptions.innerHTML = "";
			els.shippingOptions.hidden = true;
			return;
		}
		els.shippingPlaceholder.hidden = true;
		els.shippingOptions.hidden = false;
		els.shippingOptions.innerHTML = rates
			.map(
				(rate, index) => `
			<label class="checkout-shipping-option">
				<input type="radio" name="shippingRate" value="${rate.providerId}:${rate.rateId}" ${index === 0 ? "checked" : ""} />
				<span class="checkout-shipping-option-label">
					<span>${escapeHtml(rate.label)}</span>
					<strong>${escapeHtml(formatPrice(rate.amountMinor, rate.currency))}</strong>
				</span>
			</label>`,
			)
			.join("");
		els.shippingOptions.querySelectorAll('input[name="shippingRate"]').forEach((input) => {
			input.addEventListener("change", () => {
				void onShippingSelected();
			});
		});
	}

	function selectedShipping(): { providerId: string; rateId: string } | null {
		const selected = els.shippingOptions?.querySelector<HTMLInputElement>(
			'input[name="shippingRate"]:checked',
		);
		if (!selected?.value) return null;
		const [providerId, rateId] = selected.value.split(":");
		if (!providerId || !rateId) return null;
		return { providerId, rateId };
	}

	async function quoteShipping() {
		const quoted = await postCommerce<{ rates: ShippingRate[] }>(api, "checkout/shipping/quote", {
			orderId,
			finalizeToken,
		});
		shippingRates = quoted.rates ?? [];
		renderShippingRates(shippingRates);
	}

	async function applyShipping(providerId: string, rateId: string) {
		await postCommerce(api, "checkout/shipping/apply", {
			orderId,
			finalizeToken,
			providerId,
			rateId,
		});
		await loadOrder();
	}

	async function applyTax() {
		if (!taxProviderId) return;
		await postCommerce(api, "checkout/tax/apply", {
			orderId,
			finalizeToken,
			providerId: taxProviderId,
		});
		await loadOrder();
	}

	async function quoteAndApplyTax() {
		const quoted = await postCommerce<{ quote: { providerId: string } | null }>(
			api,
			"checkout/tax/quote",
			{ orderId, finalizeToken },
		);
		taxProviderId = quoted.quote?.providerId ?? null;
		if (taxProviderId) {
			await applyTax();
		}
	}

	async function preparePayment() {
		if (!currentOrder) return;
		const providerId = currentOrder.providerId?.trim() ?? "stripe";
		if (providerId === "paypal") {
			// PayPal uses a dedicated /shop/pay page with the JS SDK buttons.
			setPaymentReady(true, null);
			return;
		}
		if (providerId !== "stripe-payment-element") {
			const res = await postCommerce<{ sessionUrl?: string }>(api, "payment/initiate", {
				orderId,
				finalizeToken,
				idempotencyKey: newIdempotencyKey(),
				successUrl: `${window.location.origin}${buildStatusHref(orderId, undefined, "stripe", finalizeToken)}&session_id={CHECKOUT_SESSION_ID}`,
				cancelUrl: window.location.href,
			});
			if (res.sessionUrl) {
				window.location.href = res.sessionUrl;
			}
			return;
		}
		const res = await postCommerce<{
			clientSecret?: string;
			publishableKey?: string;
			paymentAttemptId?: string;
			bankPaymentIncentivePercent?: number;
		}>(api, "payment/initiate", {
			orderId,
			finalizeToken,
			idempotencyKey: newIdempotencyKey(),
		});
		if (!res.clientSecret || !res.publishableKey || !res.paymentAttemptId) {
			setPaymentReady(false, "Payment setup failed. Check Stripe configuration.");
			return;
		}
		paymentAttemptId = res.paymentAttemptId;
		bankPaymentIncentivePercent = res.bankPaymentIncentivePercent ?? 0;
		await mountStripe(res.publishableKey, res.clientSecret, bankPaymentIncentivePercent);
		setPaymentReady(true, null);
	}

	function setPaymentReady(ready: boolean, message: string | null) {
		if (els.placeOrder) {
			els.placeOrder.disabled = !ready || paymentBusy;
		}
		showPaymentError(message);
	}

	async function mountStripe(
		publishableKey: string,
		clientSecret: string,
		incentivePercent: number,
	) {
		if (stripeMounted || !els.paymentMount) return;
		await loadStripeScript();
		if (!window.Stripe) {
			setPaymentReady(false, "Stripe failed to load.");
			return;
		}
		stripeClient = window.Stripe(publishableKey);
		stripeElements = stripeClient.elements({
			clientSecret,
			appearance: {
				theme: "stripe",
				variables: {
					colorPrimary: "#0f172a",
					colorText: "#0f172a",
					colorDanger: "#dc2626",
					fontFamily: "Inter, system-ui, sans-serif",
					borderRadius: "4px",
				},
				rules: {
					".Input": { border: "1px solid #e2e8f0", boxShadow: "none" },
				},
			},
		});
		const paymentElement = stripeElements.create("payment");
		paymentElement.on("change", (event) => {
			void syncBankIncentive(event.value.type);
		});
		paymentElement.mount("#stripe-payment-element");
		stripeMounted = true;
		if (els.paymentSection) {
			els.paymentSection.hidden = false;
		}
		if (els.paymentHint) {
			if (incentivePercent > 0) {
				const display = Number.isInteger(incentivePercent)
					? String(incentivePercent)
					: incentivePercent.toFixed(1);
				els.paymentHint.textContent = `${display}% back when you pay with US bank account.`;
				els.paymentHint.hidden = false;
			} else {
				els.paymentHint.hidden = true;
			}
		}
	}

	async function syncBankIncentive(paymentMethodType: string | undefined) {
		if (!paymentAttemptId || bankPaymentIncentivePercent <= 0) return;
		const apply = isBankIncentivePaymentMethod(paymentMethodType);
		clearTimeout(bankIncentiveSyncTimer);
		bankIncentiveSyncTimer = setTimeout(async () => {
			try {
				const res = await postCommerce<{
					clientSecret?: string;
					amountMinor?: number;
				}>(api, "payment/bank-incentive/apply", {
					orderId,
					finalizeToken,
					paymentAttemptId,
					apply,
				});
				if (res.clientSecret && stripeElements) {
					await stripeElements.fetchUpdates();
				}
				if (typeof res.amountMinor === "number" && currentOrder) {
					currentOrder = { ...currentOrder, totalMinor: res.amountMinor };
					updateSummary(currentOrder);
				}
			} catch {
				// Non-fatal: customer can still pay at full amount.
			}
		}, 200);
	}

	async function onShippingSelected() {
		const selection = selectedShipping();
		if (!selection) return;
		try {
			showError(null);
			await applyShipping(selection.providerId, selection.rateId);
			if (currentOrder && orderNeedsTax(currentOrder)) {
				await quoteAndApplyTax();
			}
			if (currentOrder && readyToPay(currentOrder)) {
				await preparePayment();
			}
		} catch (err) {
			showError(err instanceof Error ? err.message : "Could not apply shipping.");
		}
	}

	let addressTimer: ReturnType<typeof setTimeout> | undefined;

	async function onAddressChanged() {
		if (!addressComplete()) {
			if (els.shippingPlaceholder) {
				els.shippingPlaceholder.hidden = false;
				els.shippingPlaceholder.textContent = bootstrap.requiresShipping
					? "Enter contact, address, and phone details to view shipping options."
					: "";
			}
			if (els.shippingOptions) {
				els.shippingOptions.hidden = true;
			}
			setPaymentReady(false, null);
			return;
		}
		try {
			showError(null);
			await ensureOrder();
			if (!currentOrder) return;
			if (orderNeedsShipping(currentOrder)) {
				await quoteShipping();
				const first = selectedShipping();
				if (first) {
					await applyShipping(first.providerId, first.rateId);
				}
			}
			if (currentOrder && orderNeedsTax(currentOrder)) {
				await quoteAndApplyTax();
			}
			if (currentOrder && readyToPay(currentOrder)) {
				await preparePayment();
			}
		} catch (err) {
			showError(err instanceof Error ? err.message : "Checkout step failed.");
		}
	}

	function scheduleAddressSync() {
		clearTimeout(addressTimer);
		addressTimer = setTimeout(() => {
			void onAddressChanged();
		}, 400);
	}

	async function onPlaceOrder() {
		if (!orderId || !finalizeToken) return;
		const providerId = currentOrder?.providerId?.trim() ?? "stripe";
		if (providerId === "paypal") {
			const params = new URLSearchParams({
				orderId,
				finalizeToken,
			});
			window.location.href = `/shop/pay?${params.toString()}`;
			return;
		}
		if (!stripeClient || !stripeElements) return;
		paymentBusy = true;
		setPaymentReady(false, null);
		try {
			const returnUrl = `${window.location.origin}${buildStatusHref(orderId, paymentAttemptId || undefined, "stripe-payment-element", finalizeToken)}`;
			const { error } = await stripeClient.confirmPayment({
				elements: stripeElements,
				confirmParams: { return_url: returnUrl },
				redirect: "if_required",
			});
			if (error) {
				showPaymentError(error.message ?? "Payment failed.");
				paymentBusy = false;
				setPaymentReady(true, null);
				return;
			}
			window.location.href = returnUrl;
		} catch (err) {
			showPaymentError(err instanceof Error ? err.message : "Payment failed.");
			paymentBusy = false;
			setPaymentReady(true, null);
		}
	}

	function bindFieldListeners() {
		const inputs = [
			fields.email,
			fields.firstName,
			fields.lastName,
			fields.address1,
			fields.city,
			fields.region,
			fields.postalCode,
			fields.phone,
			fields.country,
		];
		for (const input of inputs) {
			input?.addEventListener("input", scheduleAddressSync);
			input?.addEventListener("change", scheduleAddressSync);
		}
	}

	function bindBillingToggle() {
		const sync = () => {
			if (!fields.billingAddress || !fields.billingSame) return;
			fields.billingAddress.hidden = fields.billingSame.checked;
		};
		fields.billingSame?.addEventListener("change", sync);
		sync();
	}

	els.placeOrder?.addEventListener("click", () => {
		void onPlaceOrder();
	});

	bindFieldListeners();
	bindBillingToggle();

	if (els.summarySubtotal) {
		els.summarySubtotal.textContent = formatPrice(
			bootstrap.initialSubtotalMinor,
			bootstrap.currency,
		);
	}
	if (els.summaryTotal) {
		els.summaryTotal.textContent = formatPrice(bootstrap.initialSubtotalMinor, bootstrap.currency);
	}

	void (async () => {
		try {
			if (orderId && finalizeToken) {
				await loadOrder();
				if (currentOrder && orderNeedsShipping(currentOrder)) {
					await quoteShipping();
				}
				if (currentOrder && orderNeedsTax(currentOrder)) {
					await quoteAndApplyTax();
				}
				if (currentOrder && readyToPay(currentOrder)) {
					await preparePayment();
				}
			}
		} catch (err) {
			showError(err instanceof Error ? err.message : "Could not resume checkout.");
		}
	})();
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function loadStripeScript(): Promise<void> {
	if (window.Stripe) return Promise.resolve();
	return new Promise((resolve, reject) => {
		const existing = document.querySelector('script[src="https://js.stripe.com/v3/"]');
		if (existing) {
			existing.addEventListener("load", () => resolve());
			existing.addEventListener("error", () => reject(new Error("Stripe script failed")));
			return;
		}
		const script = document.createElement("script");
		script.src = "https://js.stripe.com/v3/";
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error("Stripe script failed"));
		document.head.appendChild(script);
	});
}
