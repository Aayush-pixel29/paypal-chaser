import { headers } from "next/headers";
import { env } from "@/lib/server/env";
import { verifyWebhookSignature } from "@/lib/server/paypal";
import { logWebhookEvent, updateInvoiceStatus } from "@/lib/server/ledger";

export const maxDuration = 60;

/**
 * PayPal Webhook Handler
 * Subscribed events:
 * - INVOICING.INVOICE.PAID -> Marks invoice as PAID
 * - INVOICING.INVOICE.CANCELLED -> Marks invoice as CANCELLED
 * - INVOICING.INVOICE.REFUNDED -> Logs and handles refund
 */
export async function GET() {
  return Response.json({
    status: "ok",
    service: "Chaser PayPal Webhook Listener",
    timestamp: new Date().toISOString(),
  });
}

const STATE_RANK: Record<string, number> = {
  DRAFT: 1,
  SENT: 2,
  OVERDUE: 3,
  PARTIALLY_PAID: 4,
  PAID: 5,
  CANCELLED: 6,
};

export async function POST(req: Request) {
  let rawBody = "";
  let event: Record<string, unknown> = {};

  try {
    rawBody = await req.text();
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Malformed JSON payload" }, { status: 400 });
  }

  try {
    const headersList = await headers();
    const authAlgo = headersList.get("paypal-auth-algo") || "";
    const certUrl = headersList.get("paypal-cert-url") || "";
    const transmissionId = headersList.get("paypal-transmission-id") || "";
    const transmissionSig = headersList.get("paypal-transmission-sig") || "";
    const transmissionTime = headersList.get("paypal-transmission-time") || "";

    const webhookId = env.paypal.webhookId;

    // Fail-Closed Security: if webhook ID is unconfigured or headers are missing, reject immediately with 401
    if (!webhookId || !authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
      console.warn("[webhook] Blocked: missing cryptographic signature headers or PAYPAL_WEBHOOK_ID");
      return Response.json(
        { error: "Unauthorized: Missing cryptographic signature headers or PAYPAL_WEBHOOK_ID" },
        { status: 401 },
      );
    }

    const isVerified = await verifyWebhookSignature({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: event,
    });

    if (!isVerified) {
      console.warn("[webhook] Cryptographic signature verification failed!");
      return Response.json({ error: "Unauthorized: Invalid cryptographic signature" }, { status: 401 });
    }

    const eventId = String(event.id || transmissionId || "");
    const eventType = String(event.event_type || "");
    const resource = (event.resource || {}) as Record<string, unknown>;

    // PayPal invoice ID can be in resource.id or resource.invoice?.id
    const invoiceId: string =
      (resource.invoice as { id?: string } | undefined)?.id ||
      (resource.id as string | undefined) ||
      (resource.invoice_id as string | undefined) ||
      "";

    console.log(`[webhook] Verified event: ${eventType} for invoice: ${invoiceId}`);

    if (!invoiceId) {
      await logWebhookEvent(`WEBHOOK_EVENT ${eventType} | No invoice_id in resource`, true, undefined, "PAYPAL_WEBHOOK");
      return Response.json({ status: "ignored", reason: "no_invoice_id" }, { status: 200 });
    }

    // Idempotency check: prevent replay attacks
    const { getSupabase } = await import("@/lib/server/supabase");
    const db = getSupabase();

    if (eventId) {
      const { data: existingEvent } = await db
        .from("webhook_events")
        .select("event_id")
        .eq("event_id", eventId)
        .maybeSingle();

      if (existingEvent) {
        console.log(`[webhook] Event ${eventId} already processed, ignoring replay`);
        return Response.json({ status: "ignored", reason: "duplicate_event", event_id: eventId }, { status: 200 });
      }
    }

    // Forward-only state transition helper
    const canTransition = async (targetStatus: string): Promise<boolean> => {
      const { data: currentInv } = await db
        .from("invoices")
        .select("status")
        .eq("paypal_invoice_id", invoiceId)
        .maybeSingle();

      if (!currentInv) return true;
      const currentRank = STATE_RANK[currentInv.status] ?? 1;
      const targetRank = STATE_RANK[targetStatus] ?? 0;

      // Never regress state (e.g. SENT (2) cannot overwrite PAID (5))
      if (currentRank > targetRank) {
        console.warn(
          `[webhook] State regression blocked for ${invoiceId}: ${currentInv.status} (${currentRank}) > ${targetStatus} (${targetRank})`,
        );
        return false;
      }
      return true;
    };

    if (eventType === "INVOICING.INVOICE.PAID") {
      if (await canTransition("PAID")) {
        const updated = await updateInvoiceStatus(invoiceId, "PAID");
        await logWebhookEvent(
          `PAYMENT_VERIFIED ${invoiceId} | Marked as PAID via PayPal Webhook (Cryptographically Verified)`,
          true,
          invoiceId,
          "PAYPAL_WEBHOOK",
        );
        recordEvent(db, eventId, eventType, invoiceId);
        return Response.json({ status: "success", invoice_id: invoiceId, event: eventType, updated });
      }
      return Response.json({ status: "ignored", reason: "state_regression_prevented" });
    }

    if (eventType === "INVOICING.INVOICE.SENT") {
      if (await canTransition("SENT")) {
        const updated = await updateInvoiceStatus(invoiceId, "SENT");
        await logWebhookEvent(
          `INVOICE_SENT ${invoiceId} | Confirmed SENT via PayPal Webhook`,
          true,
          invoiceId,
          "PAYPAL_WEBHOOK",
        );
        recordEvent(db, eventId, eventType, invoiceId);
        return Response.json({ status: "success", invoice_id: invoiceId, event: eventType, updated });
      }
      return Response.json({ status: "ignored", reason: "state_regression_prevented" });
    }

    if (eventType === "INVOICING.INVOICE.CANCELLED") {
      const updated = await updateInvoiceStatus(invoiceId, "CANCELLED");
      await logWebhookEvent(
        `INVOICE_CANCELLED ${invoiceId} | Marked as CANCELLED via PayPal Webhook`,
        true,
        invoiceId,
        "PAYPAL_WEBHOOK",
      );
      recordEvent(db, eventId, eventType, invoiceId);
      return Response.json({ status: "success", invoice_id: invoiceId, event: eventType, updated });
    }

    // Acknowledge other events gracefully
    await logWebhookEvent(`WEBHOOK_ACK ${eventType} for ${invoiceId}`, true, invoiceId, "PAYPAL_WEBHOOK");
    recordEvent(db, eventId, eventType, invoiceId);
    return Response.json({ status: "acknowledged", event: eventType });
  } catch (err) {
    console.error("[webhook] Error processing webhook:", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

async function recordEvent(db: unknown, eventId: string, eventType: string, invoiceId: string) {
  if (!eventId) return;
  try {
    const sdb = db as { from: (table: string) => { insert: (record: unknown) => Promise<unknown> } };
    await sdb.from("webhook_events").insert({
      event_id: eventId,
      event_type: eventType,
      paypal_invoice_id: invoiceId,
    });
  } catch (e) {
    console.warn("[webhook] Could not record webhook event in table:", (e as Error).message);
  }
}
