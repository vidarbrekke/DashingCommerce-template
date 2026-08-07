# Stripe Test Account Setup (Local Storefront)

Step-by-step guide for admins setting up **Stripe test mode** against the local Dashing Commerce storefront (`http://localhost:4321`).

Use this when:

- Standing up Stripe payments for the first time
- Switching from one Stripe account to another (for example, leaving a previous merchant account)
- Debugging checkouts that stay **Pending** after card payment

---

## What you need

| Item | Purpose |
| ---- | ------- |
| Stripe account with **Test mode** enabled | Creates test PaymentIntents / charges |
| Stripe CLI | Forwards webhooks to localhost and provides a signing secret |
| EmDash admin access on the storefront | Saves keys + payment mode |
| Running storefront | `pnpm --filter dashing-commerce-storefront-demo dev` → `http://localhost:4321` |

**Important:** Publishable key, secret key, and webhook secret must all belong to the **same** Stripe account. Mixing keys from two accounts is the most common setup failure.

---

## 1. Create or select a Stripe test account

1. Sign in at [https://dashboard.stripe.com](https://dashboard.stripe.com).
2. Confirm the toggle is set to **Test mode** (not Live).
3. Note the account (Developers → overview shows `acct_…`). All keys and CLI sessions must match this account.

If you are migrating off another merchant account, create a **new** test account (or use a clean team account) and discard the old keys from EmDash admin.

---

## 2. Copy API keys

1. Open **Developers → API keys**.
2. Copy:
   - **Publishable key** — starts with `pk_test_…`
   - **Secret key** — starts with `sk_test_…` (Reveal, then copy)

Keep these somewhere temporary; you will paste them into EmDash admin in step 5.

---

## 3. Install and log in to Stripe CLI

1. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli).
2. Log in to the **same** account as the keys:

```bash
stripe login
```

3. Confirm the CLI is on the expected account (the CLI session must match the Dashboard account that issued `pk_test_` / `sk_test_`).

---

## 4. Forward webhooks to local EmDash

Local Stripe cannot call `localhost` directly. Use the CLI:

```bash
stripe listen \
  --forward-to localhost:4321/_emdash/api/plugins/commerce/webhooks/stripe \
  --events payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled,charge.refunded
```

Leave this terminal running while you test checkout.

### Webhook signing secret (`whsec_…`)

When `stripe listen` starts, it prints a line like:

```text
Ready! Your webhook signing secret is whsec_xxxxxxxx…
```

**Use that CLI secret in EmDash admin.**

Do **not** use a Dashboard webhook endpoint signing secret for local CLI forwarding. Dashboard `whsec_…` values only work for endpoints registered in the Dashboard (staging/production). Local CLI forwarding uses a **different** secret each time you start a new `stripe listen` session (unless you persist the CLI config).

| Environment | Where webhooks come from | Which `whsec_` to save |
| ----------- | ------------------------ | ---------------------- |
| Local demo | `stripe listen` | Secret printed by the CLI |
| Staging / production | Stripe Dashboard endpoint | Signing secret for that Dashboard endpoint |

Webhook URL EmDash expects:

```text
{ORIGIN}/_emdash/api/plugins/commerce/webhooks/stripe
```

For local: `http://localhost:4321/_emdash/api/plugins/commerce/webhooks/stripe`

---

## 5. Configure EmDash admin

1. Open the storefront admin (dev bypass if needed):

```text
http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin
```

2. Open the **dashing-commerce** payment settings page.
3. Set **Payment mode** to **Stripe Payment Element (test)** (`stripe-payment-element`).
4. Open **Configure Stripe keys** and save:
   - Publishable key → `pk_test_…`
   - Secret key → `sk_test_…`
   - Webhook secret → `whsec_…` from **step 4** (`stripe listen`)
5. Save payment mode.
6. Optional checks on the same page:
   - **Test credentials**
   - **Verify webhook**
   - **Copy webhook endpoint** (should match the URL in step 4)

---

## 6. Run a smoke checkout

1. Keep `stripe listen` running.
2. Keep the storefront running on port `4321`.
3. Open `http://localhost:4321/shop`.
4. Add a product with stock → Checkout → pay with Stripe test card:

| Field | Value |
| ----- | ----- |
| Card | `4242 4242 4242 4242` |
| Expiry | Any future date |
| CVC | Any 3 digits |
| ZIP | Any valid ZIP |

5. After payment, the status page should leave **Pending** and show the order paid.

### What “good” looks like

| Check | Expected |
| ----- | -------- |
| Stripe CLI | `payment_intent.succeeded` → **`[200]`** to the webhook URL |
| Storefront status page | Order paid / finalization complete (not stuck Pending) |
| EmDash commerce orders | Order payment phase **finalized** |
| Inventory | Stock decremented for purchased SKUs |

---

## 7. Switching Stripe accounts (checklist)

When moving from Account A to Account B:

1. Log out / switch Stripe Dashboard to Account B (Test mode).
2. Copy Account B `pk_test_` and `sk_test_`.
3. Stop any old `stripe listen` process.
4. `stripe login` again for Account B.
5. Start a **new** `stripe listen` and copy the **new** `whsec_…`.
6. Update all three values in EmDash admin and save.
7. Run one smoke checkout and confirm CLI `[200]`.

Leaving an old Account A `whsec_` or `sk_test_` in admin after switching accounts causes signature failures or “silent” Pending status.

---

## Troubleshooting

### Status page stays Pending

Work through these in order:

1. **Is `stripe listen` running?** If not, Stripe never notifies EmDash.
2. **CLI response code**
   - `[200]` — webhook accepted; if still Pending, check order/finalize logs
   - `[401]` / signature errors — admin `whsec_` does not match the running CLI secret; paste the secret from the current `stripe listen` output and save again
   - `[409]` — finalize conflict (for example inventory version); check server logs for `finalize.conflict`
3. **Keys from same account?** `pk_test_`, `sk_test_`, and CLI login must all be Account B (or A), never mixed.
4. **Payment mode** must be `stripe-payment-element` for the Payment Element checkout UI.
5. Restart `stripe listen` after changing accounts, then update `whsec_` in admin.

### “Cart already has a completed checkout”

The cart cookie is still claimed by a previous checkout. After a **successful** payment, the plugin releases the claim automatically. If you hit this after a failed or stuck order:

- Complete or cancel the previous unpaid order in admin, **or**
- Clear storefront cart cookies and start a fresh cart

### Card succeeds in Stripe but order never finalizes

Money can be captured in Stripe while EmDash is still waiting on a valid webhook. Confirm CLI forwarding and `whsec_` first, then inspect EmDash admin orders / finalization diagnostics.

### Restarting local tools

| Action | Safe? |
| ------ | ----- |
| Restart Astro / rebuild plugin | Yes — does **not** wipe `demos/storefront/data.db` |
| Restart `stripe listen` | Yes — but you must update admin `whsec_` if the printed secret changed |
| `pnpm bootstrap` / reset demo DB | No — only when you intentionally want a clean slate |

---

## Quick reference commands

```bash
# Storefront (preserves local DB)
pnpm --filter dashing-commerce-storefront-demo dev

# Stripe CLI webhook forward (leave running)
stripe listen \
  --forward-to localhost:4321/_emdash/api/plugins/commerce/webhooks/stripe \
  --events payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled,charge.refunded

# Optional: resend a past event after a config fix
stripe events resend evt_...
```

---

## Related docs

- Local demo lifecycle: [`guide-dev-local.md`](./guide-dev-local.md)
- Live / staging verification runbook: [`../../../packages/plugins/dashing-commerce/docs/LIVE_PAYMENT_VERIFICATION.md`](../../../packages/plugins/dashing-commerce/docs/LIVE_PAYMENT_VERIFICATION.md)
- Automated Stripe E2E env vars: [`../../../packages/plugins/dashing-commerce/docs/STRIPE_VALIDATION.md`](../../../packages/plugins/dashing-commerce/docs/STRIPE_VALIDATION.md)
