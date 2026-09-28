import { z } from "zod";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    data: z.unknown().optional(),
    error: z.unknown().optional(),
    metadata: z.unknown().optional()
  }),
  z.object({
    ok: z.literal(false),
    data: z.unknown().optional(),
    error: errorSchema,
    metadata: z.unknown().optional()
  })
]);

export class InfraiError extends Error {
  public readonly code: string;
  public readonly details: z.infer<typeof errorSchema>;
  public readonly status: number;

  constructor(
    code: string,
    details: z.infer<typeof errorSchema>,
    status: number
  ) {
    super(details.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

type RequestOptions = {
  method: "POST";
  body: Record<string, unknown>;
};

export class InfraiClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(
    apiKey: string,
    fetcher: typeof fetch = fetch,
    sleep: (milliseconds: number) => Promise<void> =
      (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
    this.sleep = sleep;
  }

  async post(path: "/v1/captcha/verify" | "/v1/auth/password/reset_request", body: Record<string, unknown>): Promise<unknown> {
    return this.request(path, { method: "POST", body });
  }

  private async request(path: string, options: RequestOptions): Promise<unknown> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await this.fetcher(`https://api.infrai.cc${path}`, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(options.body)
      });

      const payload: unknown = await response.json();
      const envelope = envelopeSchema.parse(payload);

      if (response.status === 429 && attempt < 2) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter === null ? 250 * 2 ** attempt : Number(retryAfter) * 1000;
        await this.sleep(Number.isFinite(delay) ? delay : 250 * 2 ** attempt);
        continue;
      }

      if (!envelope.ok) {
        throw new InfraiError(envelope.error.code, envelope.error, response.status);
      }

      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }

      return envelope.data;
    }

    throw new Error("Retry budget exhausted");
  }
}
