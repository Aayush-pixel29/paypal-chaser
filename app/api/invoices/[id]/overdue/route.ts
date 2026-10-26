import { updateInvoiceStatus, logWebhookEvent } from "@/lib/server/ledger";

export const maxDuration = 60;

/**
 * Demo Simulation Endpoint:
 * Flips an invoice status to OVERDUE to test the Autonomous Chaser escalation flow
 * without waiting 7-14 real days during judging.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const paypalInvoiceId = id;

    if (!paypalInvoiceId) {
      return Response.json({ error: "Missing invoice ID" }, { status: 400 });
    }

    console.log(`[chaser] Simulating 7 days overdue for invoice ${paypalInvoiceId}...`);
    
    // Update Supabase status to OVERDUE
    await updateInvoiceStatus(paypalInvoiceId, "OVERDUE");

    // Log escalation trigger in agent audit trail
    await logWebhookEvent(
      `STATUS_ESCALATED ${paypalInvoiceId} | Marked as 7 Days OVERDUE (Autonomous Chaser Triggered)`,
      true,
    );

    return Response.json({
      success: true,
      paypal_invoice_id: paypalInvoiceId,
      status: "OVERDUE",
      message: "Invoice marked as 7 days overdue. Autonomous Chaser escalation activated.",
    });
  } catch (err) {
    const errorMsg = (err as Error).message || "";
    console.error("[chaser] Overdue simulation failed:", errorMsg);
    if (errorMsg.includes("not found in ledger")) {
      return Response.json({ error: errorMsg }, { status: 404 });
    }
    return Response.json({ error: errorMsg }, { status: 500 });
  }
}
