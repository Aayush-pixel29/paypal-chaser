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

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const event = JSON.parse(rawBody);

    const headersList = await headers();
    const authAlgo = headersList.get("paypal-auth-algo") || "";
    const certUrl = headersList.get("paypal-cert-url") || "";
    const transmissionId = headersList.get("paypal-transmission-id") || "";
    const transmissionSig = headersList.get("paypal-transmission-sig") || "";
    const transmissionTime = headersList.get("paypal-transmission-time") || "";

    const webhookId = env.paypal.webhookId;

    // Verify signature with PayPal if webhook ID is configured and headers are present
    if (webhookId && authAlgo && certUrl && transmissionId && transmissionSig && transmissionTime) {
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
        console.warn("[webhook] Signature verification failed!");
        return Response.json({ error: "Invalid signature" }, { status: 400 });
      }
    } else {
      console.log(
        "[webhook] Proceeding without signature verification (Webhook ID not set or simulator event)",
      );
    }

    const eventType: string = event.event_type || "";
    const resource = event.resource || {};
    
    // PayPal invoice ID can be in resource.id or resource.invoice?.id
    const invoiceId: string =
      resource.invoice?.id ||
      resource.id ||
      resource.invoice_id ||
      "";

    console.log(`[webhook] Received event: ${eventType} for invoice: ${invoiceId}`);

    if (!invoiceId) {
      await logWebhookEvent(`WEBHOOK_EVENT ${eventType} | No invoice_id found in resource`, true);
      return Response.json({ status: "ignored", reason: "no_invoice_id" }, { status: 200 });
    }

    if (eventType === "INVOICING.INVOICE.PAID") {
      const updated = await updateInvoiceStatus(invoiceId, "PAID");
      await logWebhookEvent(
        `PAYMENT_VERIFIED ${invoiceId} | Marked as PAID via PayPal Webhook`,
        true,
      );
      return Response.json({ status: "success", invoice_id: invoiceId, event: eventType, updated });
    }

    if (eventType === "INVOICING.INVOICE.SENT") {
      const updated = await updateInvoiceStatus(invoiceId, "SENT");
      await logWebhookEvent(
        `INVOICE_SENT ${invoiceId} | Confirmed SENT via PayPal Webhook`,
        true,
      );
      return Response.json({ status: "success", invoice_id: invoiceId, event: eventType, updated });
    }

    if (eventType === "INVOICING.INVOICE.UPDATED") {
      await logWebhookEvent(
        `INVOICE_UPDATED ${invoiceId} | Updated in PayPal`,
        true,
      );
      return Response.json({ status: "success", invoice_id: invoiceId, event: eventType });
    }

    if (eventType === "INVOICING.INVOICE.CANCELLED") {
      const updated = await updateInvoiceStatus(invoiceId, "CANCELLED");
      await logWebhookEvent(
        `INVOICE_CANCELLED ${invoiceId} | Marked as CANCELLED via PayPal Webhook`,
        true,
      );
      return Response.json({ status: "success", invoice_id: invoiceId, event: eventType, updated });
    }

    // Acknowledge other events gracefully
    await logWebhookEvent(`WEBHOOK_ACK ${eventType} for ${invoiceId}`, true);
    return Response.json({ status: "acknowledged", event: eventType });
  } catch (err) {
    console.error("[webhook] Error processing webhook:", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
