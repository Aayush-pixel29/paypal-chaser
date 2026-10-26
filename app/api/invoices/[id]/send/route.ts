import { sendInvoice } from "@/lib/server/paypal";
import { logWebhookEvent, markLogApproved } from "@/lib/server/ledger";

export const maxDuration = 60;

/**
 * Human-In-The-Loop Approval Route:
 * Dispatches a draft invoice through PayPal's official API
 * and updates the Supabase ledger status from DRAFT to SENT.
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

    let note = "Thank you for your business. Please remit payment via PayPal.";
    try {
      const body = await req.json();
      if (body?.note) note = body.note;
    } catch {
      // JSON body is optional
    }

    // Call PayPal's /v2/invoicing/invoices/{id}/send endpoint
    console.log(`[approval] Dispatching invoice ${paypalInvoiceId} to client via PayPal API...`);
    const result = await sendInvoice(paypalInvoiceId, {
      note,
      send_to_recipient: true,
    });

    // Update status in Supabase ledger
    const payerViewUrl = result?.href || `https://www.sandbox.paypal.com/invoice/p/#${paypalInvoiceId}`;
    const { getSupabase } = await import("@/lib/server/supabase");
    await getSupabase()
      .from("invoices")
      .update({ status: "SENT", payer_view_url: payerViewUrl })
      .eq("paypal_invoice_id", paypalInvoiceId);

    // Mark the pending proposal as approved
    await markLogApproved(paypalInvoiceId);

    // Record human approval event in activity log
    await logWebhookEvent(
      `HUMAN_APPROVED ${paypalInvoiceId} | Dispatched to recipient via PayPal API`,
      true,
      paypalInvoiceId,
      "HUMAN_OPERATOR",
    );

    return Response.json({
      success: true,
      paypal_invoice_id: paypalInvoiceId,
      status: "SENT",
      payer_view_url: payerViewUrl,
      result,
    });
  } catch (err) {
    const errorMsg = (err as Error).message || "";
    console.error("[approval] Failed to send invoice:", errorMsg);

    if (errorMsg.includes("RESOURCE_NOT_FOUND") || errorMsg.includes("not found in ledger")) {
      return Response.json({ error: `Invoice ${paypalInvoiceId} not found in PayPal or ledger` }, { status: 404 });
    }

    if (errorMsg.includes("INR_FOREIGN_CURRENCY_BLOCKED")) {
      return Response.json(
        {
          error:
            "PayPal Cross-Border Policy: Since the merchant sandbox account is in India (IN), PayPal restricts sending foreign currencies (USD) to domestic accounts. Ensure the client's billing address is international (e.g., US/UK) when drafting foreign currency invoices.",
        },
        { status: 400 },
      );
    }

    return Response.json({ error: errorMsg }, { status: 500 });
  }
}
