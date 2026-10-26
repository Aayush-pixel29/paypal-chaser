import { remindInvoice } from "@/lib/server/paypal";
import { logWebhookEvent } from "@/lib/server/ledger";

export const maxDuration = 60;

/**
 * Autonomous Chaser: Dispatch Tone-Escalated Reminder
 * Calls PayPal's official POST /v2/invoicing/invoices/{id}/remind endpoint.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let paypalInvoiceId = "";
  try {
    const { id } = await params;
    paypalInvoiceId = id;

    if (!paypalInvoiceId) {
      return Response.json({ error: "Missing invoice ID" }, { status: 400 });
    }

    let subject = "Payment Reminder: Invoice is 7 days past due";
    let note =
      "Hello, this is a friendly reminder that your invoice is now 7 days past due. Please review and remit payment via the secure PayPal link at your earliest convenience.";

    try {
      const body = await req.json();
      if (body?.subject) subject = body.subject;
      if (body?.note) note = body.note;
    } catch {
      // Optional body
    }

    console.log(`[chaser] Dispatching reminder for invoice ${paypalInvoiceId} via PayPal API...`);
    const result = await remindInvoice(paypalInvoiceId, {
      subject,
      note,
      send_to_recipient: true,
    });

    // Record reminder dispatch in agent audit trail
    await logWebhookEvent(
      `REMINDER_SENT ${paypalInvoiceId} | Escalated reminder dispatched to client via PayPal API`,
      true,
      paypalInvoiceId,
      "HUMAN_OPERATOR",
    );

    return Response.json({
      success: true,
      paypal_invoice_id: paypalInvoiceId,
      result,
      message: "Escalated reminder dispatched via PayPal API.",
    });
  } catch (err) {
    const errorMsg = (err as Error).message || "";
    console.error("[chaser] Remind failed:", errorMsg);
    if (errorMsg.includes("RESOURCE_NOT_FOUND") || errorMsg.includes("not found in ledger")) {
      return Response.json({ error: `Invoice ${paypalInvoiceId} not found in PayPal or ledger` }, { status: 404 });
    }
    return Response.json({ error: errorMsg }, { status: 500 });
  }
}
