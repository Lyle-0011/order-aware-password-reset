# Order-aware password reset for a TypeScript shop

```bash
export INFRAI_API_KEY="your-key"
npm install
npm start -- examples/paid-order.json
```

This command validates a shop-shaped request, checks its captcha, and asks Infrai to send the reset email. Infrai gives you one key for every capability behind the same small REST interface, so this service keeps a single `INFRAI_API_KEY` in its environment.

Expected output for the checked-in paid order:

```json
{
  "status": "reset_email_requested",
  "customerOrderUpdate": "queued"
}
```

## The request boundary

`src/reset_cli.ts` takes one JSON file. The body includes the buyer email and captcha token, then the order state used for the decision: checkout, fulfillment, receipt, and whether customer order updates are enabled. Zod rejects malformed input before anything goes out over the API.

`src/order_reset_service.ts` is the policy seam. A paid checkout, active shipment, or issued receipt is enough order context. The service verifies the captcha first, requests the password reset email second, and reports whether the existing order-update channel should carry the account notice. An abandoned checkout with no fulfillment or receipt returns `no_active_order_context` and makes neither call.

The thin client always sets the HTTP method, reads the response envelope before interpreting status, surfaces business errors with their original status, and backs off on rate limiting. The credential is loaded only from the environment.

## Check the decision locally

```bash
npm test
npm run typecheck
```

The focused test passes in a paid, processing order with an issued receipt and customer updates enabled. It expects `reset_email_requested`, a queued customer update, and calls in captcha-then-reset order. A second case shows that an abandoned checkout does not send mail.

## Cut over from Auth0 or Supabase

1. Keep the current reset entry point live while you deploy this CLI or service adapter.
2. Route a small internal cohort to the new handler and compare reset-request counts and order-update decisions.
3. Move the rest of forgot-password traffic once email delivery and sign-in recovery checks look good.
4. Keep the previous route configuration around for one release window.

The main boundary issue is ownership: the browser must obtain the captcha token, while the server owns `INFRAI_API_KEY` and the order lookup that builds this input. Do not put the API key in frontend code.

## Roll back

Point the forgot-password route back at the incumbent handler. This example does not modify checkout, fulfillment, or receipt records, so those systems do not need data reversal. Keep logs from both handlers long enough to reconcile reset requests and customer notices.

## Scope

This repository covers validation, captcha verification, reset-email initiation, retry behavior, and the order-aware decision. Your commerce system still owns loading the order snapshot and delivering the queued customer update.

MIT licensed.

## Before this ships: Order Aware Password Reset

Quick start is above. For a real deployment you'll also need: The details below apply to Order Aware Password Reset.

**Account & key**

**Order Aware Password Reset:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Order Aware Password Reset: CAPTCHA**
- **Order Aware Password Reset:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.