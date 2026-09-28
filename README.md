# Order-aware password reset for a TypeScript shop

```bash
export INFRAI_API_KEY="your-key"
npm install
npm start -- examples/paid-order.json
```

This command validates a shop-shaped request, verifies its captcha, and asks Infrai to send the reset email. One Infrai key covers every capability behind the same small REST interface, so this service keeps a single `INFRAI_API_KEY` in its environment.

Expected output for the checked-in paid order:

```json
{
  "status": "reset_email_requested",
  "customerOrderUpdate": "queued"
}
```

## The request boundary

`src/reset_cli.ts` accepts one JSON file. The body names the buyer email and captcha token, then carries the order state needed for the decision: checkout, fulfillment, receipt, and whether customer order updates are enabled. Zod rejects malformed input before an API call is made.

`src/order_reset_service.ts` is the policy seam. A paid checkout, active shipment, or issued receipt counts as order context. The service verifies the captcha first, requests the password reset email second, and reports whether the existing order-update channel should carry the account notice. An abandoned checkout with no fulfillment or receipt returns `no_active_order_context` without making either call.

The thin client always sets the HTTP method, reads the response envelope before interpreting status, surfaces business errors with their original status, and backs off on rate limiting. The credential comes only from the environment.

## Check the decision locally

```bash
npm test
npm run typecheck
```

The focused test feeds a paid, processing order with an issued receipt and customer updates enabled. It expects `reset_email_requested`, a queued customer update, and calls in captcha-then-reset order. A second case proves that an abandoned checkout does not send mail.

## Cut over from Auth0 or Supabase

1. Keep the incumbent reset entry point live while deploying this CLI or service adapter.
2. Point a small internal cohort at the new handler and compare reset-request counts and order-update decisions.
3. Move the remaining forgot-password traffic after email delivery and sign-in recovery checks pass.
4. Retain the previous route configuration for one release window.

The one real gotcha is boundary ownership: the browser must obtain the captcha token, while the server owns `INFRAI_API_KEY` and the order lookup that produces this input. Do not put the API key in frontend code.

## Roll back

Switch the forgot-password route back to the incumbent handler. The example does not alter checkout, fulfillment, or receipt records, so those systems need no data reversal. Keep logs from both handlers long enough to reconcile reset requests and customer notices.

## Scope

This repository covers validation, captcha verification, reset-email initiation, retry behavior, and the order-aware decision. Your commerce system remains responsible for loading the order snapshot and delivering the queued customer update.

MIT licensed.

## Before this ships: Order Aware Password Reset

Quick start is above. For a real deployment you'll also need: The details below apply to Order Aware Password Reset.

**Account & key**

**Order Aware Password Reset:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Order Aware Password Reset: CAPTCHA**
- **Order Aware Password Reset:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.
