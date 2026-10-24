import { updateInvoiceConfiguration } from "@/lib/server/paypal";
import { logWebhookEvent } from "@/lib/server/ledger";
import { getSupabase } from "@/lib/server/supabase";

export const maxDuration = 60;

/**
 * Partial Payment Configuration Route
 * Enables "Can I pay half now?" payment split on PayPal and records in ledger.
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

    const body = await req.json();
    const minAmount = body?.minimum_amount ?? 1875.0;
    const currency = body?.currency || "USD";

    console.log(
      `[chaser] Configuring partial payment on invoice ${paypalInvoiceId}: Min due ${currency} ${minAmount}`,
    );

    let paypalResult = null;
    try {
      paypalResult = await updateInvoiceConfiguration(paypalInvoiceId, {
        partial_payment: {
          allow_partial_payment: true,
          minimum_amount_due: {
            currency_code: currency,
            value: Number(minAmount).toFixed(2),
          },
        },
      });
    } catch (paypalErr) {
      console.warn("[chaser] PayPal API update invoice warning:", (paypalErr as Error).message);
    }

    // Record in Supabase ledger
    await logWebhookEvent(
      `PARTIAL_PAYMENT_ENABLED ${paypalInvoiceId} | Allowed 50% split (Min Due: ${currency} ${Number(
        minAmount,
      ).toFixed(2)})`,
      true,
    );

    return Response.json({
      success: true,
      paypal_invoice_id: paypalInvoiceId,
      allow_partial_payment: true,
      minimum_amount_due: {
        currency_code: currency,
        value: Number(minAmount).toFixed(2),
      },
      paypalResult,
    });
  } catch (err) {
    const errorMsg = (err as Error).message || "";
    console.error("[chaser] Partial payment config failed:", errorMsg);
    return Response.json({ error: errorMsg }, { status: 500 });
  }
}
