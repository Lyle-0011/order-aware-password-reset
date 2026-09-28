import { readFile } from "node:fs/promises";
import { InfraiClient, InfraiError } from "./infrai_client.js";
import { InfraiPasswordResetGateway, requestOrderAwareReset } from "./order_reset_service.js";

async function main(): Promise<void> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) {
    throw new Error("Set INFRAI_API_KEY before running the command");
  }

  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: npm start -- <request.json>");
  }

  const input: unknown = JSON.parse(await readFile(inputPath, "utf8"));
  const gateway = new InfraiPasswordResetGateway(new InfraiClient(apiKey));
  const result = await requestOrderAwareReset(input, gateway);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error: unknown) => {
  if (error instanceof InfraiError) {
    process.stderr.write(`${JSON.stringify({ error: error.code, status: error.status })}\n`);
    process.exitCode = error.status >= 400 && error.status < 500 ? 2 : 1;
    return;
  }

  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
