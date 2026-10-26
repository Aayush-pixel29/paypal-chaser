import "server-only";
import { env } from "./env";

/**
 * Minimal PayPal REST client used for deterministic, non-AI operations
 * (reading invoice details now; human-approved send in Phase 5).
 */

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }
  const basic = Buffer.from(`${env.paypal.clientId}:${env.paypal.clientSecret}`).toString(
    "base64",
  );
  const res = await fetch(`${env.paypal.apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`PayPal OAuth failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

export async function paypalFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${env.paypal.apiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PayPal ${init.method ?? "GET"} ${path} failed (${res.status}): ${text}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export interface PayPalInvoice {
  id: string;
  status: string;
  detail?: {
    invoice_number?: string;
    currency_code?: string;
    reference?: string;
    invoice_date?: string;
    note?: string;
    term?: string;
    memo?: string;
    payment_term?: unknown;
    recipient_view_url?: string;
    invoicer_view_url?: string;
  };
  invoicer?: unknown;
  configuration?: Record<string, unknown>;
  amount?: { currency_code: string; value: string };
  primary_recipients?: Array<{
    billing_info?: {
      email_address?: string;
      name?: { given_name?: string; surname?: string; full_name?: string };
      address?: { country_code?: string; [key: string]: unknown };
    };
  }>;
  items?: unknown[];
  links?: Array<{ href: string; rel: string; method?: string }>;
}

export function getInvoice(invoiceId: string) {
  return paypalFetch<PayPalInvoice>(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`);
}

export async function sendInvoice(
  invoiceId: string,
  options: { note?: string; send_to_recipient?: boolean; send_to_invoicer?: boolean } = {
    send_to_recipient: true,
    send_to_invoicer: true,
  },
) {
  return paypalFetch<{ href?: string }>(
    `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/send`,
    {
      method: "POST",
      body: JSON.stringify({
        send_to_recipient: options.send_to_recipient ?? true,
        send_to_invoicer: options.send_to_invoicer ?? true,
        ...(options.note ? { note: options.note } : {}),
      }),
    },
  );
}

export async function remindInvoice(
  invoiceId: string,
  options: { subject?: string; note?: string; send_to_recipient?: boolean } = {},
) {
  return paypalFetch<Record<string, unknown>>(
    `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/remind`,
    {
      method: "POST",
      body: JSON.stringify({
        subject: options.subject || "Payment Reminder: Invoice Payment Due",
        note: options.note || "This is a polite reminder that payment for this invoice is due.",
        send_to_recipient: options.send_to_recipient ?? true,
      }),
    },
  );
}

export async function createInvoiceDirect(payload: Record<string, unknown>): Promise<{ id: string; href: string }> {
  const res = await paypalFetch<{ rel: string; href: string; id?: string }>("/v2/invoicing/invoices", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const id = res.id || res.href?.split("/").pop() || "";
  return { id, href: res.href };
}

export async function enablePartialPaymentOnPayPal(
  invoiceId: string,
  minimumAmount: number,
  currencyCode = "USD",
) {
  const existing = await getInvoice(invoiceId);

  // Strip read-only fields that cause PayPal PUT to fail
  const cleanPayload = {
    detail: {
      invoice_number: existing.detail?.invoice_number,
      reference: existing.detail?.reference,
      invoice_date: existing.detail?.invoice_date,
      currency_code: existing.detail?.currency_code || currencyCode,
      note: existing.detail?.note,
      term: existing.detail?.term,
      memo: existing.detail?.memo,
      payment_term: existing.detail?.payment_term,
    },
    invoicer: existing.invoicer,
    primary_recipients: existing.primary_recipients,
    items: existing.items,
    configuration: {
      ...(existing.configuration ?? {}),
      partial_payment: {
        allow_partial_payment: true,
        minimum_amount_due: {
          currency_code: existing.detail?.currency_code || currencyCode,
          value: minimumAmount.toFixed(2),
        },
      },
    },
  };

  return paypalFetch<PayPalInvoice>(
    `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}?send_to_recipient=true`,
    {
      method: "PUT",
      body: JSON.stringify(cleanPayload),
    },
  );
}

export async function updateInvoiceConfiguration(
  invoiceId: string,
  configuration: {
    partial_payment?: {
      allow_partial_payment: boolean;
      minimum_amount_due?: {
        currency_code: string;
        value: string;
      };
    };
  },
) {
  const minAmount = Number(configuration.partial_payment?.minimum_amount_due?.value || 0);
  const currency = configuration.partial_payment?.minimum_amount_due?.currency_code || "USD";
  return enablePartialPaymentOnPayPal(invoiceId, minAmount, currency);
}

export interface WebhookVerificationParams {
  auth_algo: string;
  cert_url: string;
  transmission_id: string;
  transmission_sig: string;
  transmission_time: string;
  webhook_id: string;
  webhook_event: Record<string, unknown>;
}

export async function verifyWebhookSignature(
  params: WebhookVerificationParams,
): Promise<boolean> {
  try {
    const res = await paypalFetch<{ verification_status: string }>(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    );
    return res.verification_status === "SUCCESS";
  } catch (err) {
    console.error("[paypal] verifyWebhookSignature error:", err);
    return false;
  }
}
