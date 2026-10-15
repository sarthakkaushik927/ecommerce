import { env } from "../../config/env.js";
import { toE164 } from "../../lib/phone.js";
import type { SendResult, WhatsAppProvider } from "./types.js";

const REQUEST_TIMEOUT_MS = 10_000;

interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

async function readError(response: FetchResponse): Promise<string> {
  const body = await response.text().catch(() => "");
  return `HTTP ${response.status}: ${body.slice(0, 300)}`;
}

/** Meta WhatsApp Cloud API. Free-form text only works inside the 24h customer window; use templates beyond that. */
class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly name = "meta";

  constructor(
    private readonly token: string,
    private readonly phoneNumberId: string,
  ) {}

  async send(to: string, body: string): Promise<SendResult> {
    const response = (await fetch(`https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toE164(to).slice(1),
        type: "text",
        text: { body, preview_url: false },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })) as unknown as FetchResponse;
    if (!response.ok) return { status: "FAILED", error: await readError(response) };
    const json = (await response.json()) as { messages?: { id: string }[] };
    return { status: "SENT", providerRef: json.messages?.[0]?.id };
  }
}

class TwilioWhatsAppProvider implements WhatsAppProvider {
  readonly name = "twilio";

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly from: string,
  ) {}

  async send(to: string, body: string): Promise<SendResult> {
    const form = new URLSearchParams({
      From: `whatsapp:${toE164(this.from)}`,
      To: `whatsapp:${toE164(to)}`,
      Body: body,
    });
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
    const response = (await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    )) as unknown as FetchResponse;
    if (!response.ok) return { status: "FAILED", error: await readError(response) };
    const json = (await response.json()) as { sid?: string };
    return { status: "SENT", providerRef: json.sid };
  }
}

/** Records the message only; the admin dashboard offers wa.me links instead. */
class LogWhatsAppProvider implements WhatsAppProvider {
  readonly name = "log";

  async send(): Promise<SendResult> {
    return { status: "SKIPPED", reason: "WhatsApp provider not configured (log mode)" };
  }
}

function createProvider(): WhatsAppProvider {
  if (env.WHATSAPP_PROVIDER === "meta" && env.WHATSAPP_META_TOKEN && env.WHATSAPP_META_PHONE_ID) {
    return new MetaWhatsAppProvider(env.WHATSAPP_META_TOKEN, env.WHATSAPP_META_PHONE_ID);
  }
  if (
    env.WHATSAPP_PROVIDER === "twilio" &&
    env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    env.TWILIO_WHATSAPP_FROM
  ) {
    return new TwilioWhatsAppProvider(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_WHATSAPP_FROM);
  }
  return new LogWhatsAppProvider();
}

export const whatsapp = createProvider();

export async function sendWhatsApp(to: string, body: string): Promise<SendResult> {
  try {
    return await whatsapp.send(to, body);
  } catch (error) {
    return { status: "FAILED", error: error instanceof Error ? error.message : String(error) };
  }
}
