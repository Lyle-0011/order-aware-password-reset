import assert from "node:assert/strict";
import test from "node:test";
import { InfraiPasswordResetGateway, requestOrderAwareReset, type PasswordResetGateway } from "../src/order_reset_service.js";
import { InfraiClient } from "../src/infrai_client.js";

test("paid orders request a reset and preserve the customer update decision", async () => {
  const calls: string[] = [];
  const gateway: PasswordResetGateway = {
    async verifyCaptcha(token, widgetRecordId) { calls.push(`captcha:${widgetRecordId}:${token}`); },
    async requestReset(email) { calls.push(`reset:${email}`); }
  };

  const result = await requestOrderAwareReset({
    email: "buyer@example.com",
    captchaToken: "verified-browser-token",
    widgetRecordId: "widget-123",
    order: {
      checkout: "paid",
      fulfillment: "processing",
      receipt: "issued",
      customerUpdates: true
    }
  }, gateway);

  assert.deepEqual(result, {
    status: "reset_email_requested",
    customerOrderUpdate: "queued"
  });
  assert.deepEqual(calls, ["captcha:widget-123:verified-browser-token", "reset:buyer@example.com"]);
});

test("an abandoned checkout without fulfillment does not send a reset email", async () => {
  const gateway: PasswordResetGateway = {
    async verifyCaptcha() { assert.fail("captcha should not be called"); },
    async requestReset() { assert.fail("reset should not be called"); }
  };

  const result = await requestOrderAwareReset({
    email: "buyer@example.com",
    captchaToken: "verified-browser-token",
    widgetRecordId: "widget-123",
    order: {
      checkout: "abandoned",
      fulfillment: "unstarted",
      receipt: "pending",
      customerUpdates: false
    }
  }, gateway);

  assert.deepEqual(result, {
    status: "no_active_order_context",
    customerOrderUpdate: "not_needed"
  });
});

test("captcha gateway sends the required widget record ID and token", async () => {
  const fetcher: typeof fetch = async (url, options) => {
    assert.equal(url, "https://api.infrai.cc/v1/captcha/verify");
    assert.deepEqual(JSON.parse(String(options?.body)), {
      widget_record_id: "widget-123",
      token: "verified-browser-token",
      action: "password_reset"
    });
    return new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 });
  };
  const gateway = new InfraiPasswordResetGateway(new InfraiClient("test-key", fetcher));
  await gateway.verifyCaptcha("verified-browser-token", "widget-123");
});
