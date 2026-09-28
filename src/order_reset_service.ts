import { z } from "zod";
import { InfraiClient } from "./infrai_client.js";

export const resetRequestSchema = z.object({
  email: z.string().email(),
  captchaToken: z.string().min(1),
  widgetRecordId: z.string().min(1),
  order: z.object({
    checkout: z.enum(["open", "paid", "abandoned"]),
    fulfillment: z.enum(["unstarted", "processing", "shipped", "delivered"]),
    receipt: z.enum(["pending", "issued"]),
    customerUpdates: z.boolean()
  })
});

export type ResetRequest = z.infer<typeof resetRequestSchema>;

export type ResetDecision =
  | { status: "reset_email_requested"; customerOrderUpdate: "queued" | "not_needed" }
  | { status: "no_active_order_context"; customerOrderUpdate: "not_needed" };

export interface PasswordResetGateway {
  verifyCaptcha(token: string, widgetRecordId: string): Promise<void>;
  requestReset(email: string): Promise<void>;
}

export class InfraiPasswordResetGateway implements PasswordResetGateway {
  private readonly client: InfraiClient;

  constructor(client: InfraiClient) {
    this.client = client;
  }

  async verifyCaptcha(token: string, widgetRecordId: string): Promise<void> {
    await this.client.post("/v1/captcha/verify", {
      widget_record_id: widgetRecordId,
      token,
      action: "password_reset"
    });
  }

  async requestReset(email: string): Promise<void> {
    await this.client.post("/v1/auth/password/reset_request", { email });
  }
}

export async function requestOrderAwareReset(
  rawInput: unknown,
  gateway: PasswordResetGateway
): Promise<ResetDecision> {
  const input = resetRequestSchema.parse(rawInput);
  const hasOrderContext =
    input.order.checkout === "paid" ||
    input.order.fulfillment === "processing" ||
    input.order.fulfillment === "shipped" ||
    input.order.receipt === "issued";

  if (!hasOrderContext) {
    return { status: "no_active_order_context", customerOrderUpdate: "not_needed" };
  }

  await gateway.verifyCaptcha(input.captchaToken, input.widgetRecordId);
  await gateway.requestReset(input.email);

  return {
    status: "reset_email_requested",
    customerOrderUpdate: input.order.customerUpdates ? "queued" : "not_needed"
  };
}
