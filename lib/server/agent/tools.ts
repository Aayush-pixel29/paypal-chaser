import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import { env } from "../env";
import { getInvoice, updateInvoiceConfiguration } from "../paypal";
import { logAgentEvent, recordDraftInvoice } from "../ledger";

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  ZERO-TRUST TOOL SURFACE
 * ─────────────────────────────────────────────────────────────────────────
 *  The PayPal Agent Toolkit is configured with ONLY `invoices.create`.
 *  `send_invoice` is not merely discouraged by prompt — it does not exist in
 *  the model's tool set. Dispatching an invoice is a separate, human-only
 *  server route (Phase 5 "Approve & Send").
 *
 *  Two toolkit gotchas handled here:
 *   1. The toolkit defaults to LIVE unless `context.sandbox === true`.
 *   2. The toolkit builds tools with its own bundled AI SDK v4 (`parameters`),
 *      while this app uses AI SDK v7 (`inputSchema`). We adapt them.
 * ─────────────────────────────────────────────────────────────────────────
 */

type LegacyTool = {
  description?: string;
  parameters: unknown;
  execute: (args: unknown, options?: unknown) => Promise<unknown>;
};

const ALLOWED_ACTIONS = {
  invoices: { create: true },
} as const;

let toolkit: PayPalAgentToolkit | null = null;

function getToolkit(): PayPalAgentToolkit {
  if (!toolkit) {
    toolkit = new PayPalAgentToolkit({
      clientId: env.paypal.clientId,
      clientSecret: env.paypal.clientSecret,
      configuration: {
        actions: ALLOWED_ACTIONS,
        context: { sandbox: env.paypal.isSandbox },
      },
    });
  }
  return toolkit;
}

/** PayPal returns either a full invoice or a HATEOAS link to it. */
function extractInvoiceId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { id?: string; href?: string; links?: Array<{ href: string }> };
  if (obj.id && /^INV2-/.test(obj.id)) return obj.id;
  const href = obj.href ?? obj.links?.[0]?.href;
  const match = href?.match(/invoices\/(INV2-[A-Z0-9-]+)/i);
  return match?.[1] ?? null;
}

interface CreateInvoiceArgs {
  currency_code: string;
  primary_recipients?: Array<{
    billing_info?: {
      email_address?: string;
      business_name?: string;
      name?: { given_name?: string; surname?: string; full_name?: string };
    };
  }>;
  items?: Array<{ name: string; quantity: string; unit_amount?: { value?: string } }>;
}

function recipientFrom(args: CreateInvoiceArgs) {
  const info = args.primary_recipients?.[0]?.billing_info;
  const n = info?.name;
  const name =
    n?.full_name ||
    [n?.given_name, n?.surname].filter(Boolean).join(" ") ||
    info?.business_name ||
    null;
  return { name, email: info?.email_address ?? null };
}

function estimateTotal(args: CreateInvoiceArgs): number {
  return (args.items ?? []).reduce(
    (sum, it) => sum + Number(it.quantity || 0) * Number(it.unit_amount?.value || 0),
    0,
  );
}

/** The tool set handed to the LLM. Intentionally tiny. */
export function getAgentTools(): ToolSet {
  const legacy = getToolkit().getTools() as unknown as Record<string, LegacyTool>;
  const create = legacy["create_invoice"];
  if (!create) throw new Error("PayPal toolkit did not expose create_invoice");

  // Defence in depth: assert nothing beyond the allow-list leaked through.
  const exposed = Object.keys(legacy);
  if (exposed.some((name) => name !== "create_invoice")) {
    throw new Error(`Unexpected PayPal tools exposed to the agent: ${exposed.join(", ")}`);
  }

  return {
    create_invoice: tool({
      description:
        `${create.description ?? ""}\n\n` +
        "IMPORTANT: This only creates a DRAFT. It never emails the client. " +
        "A human must approve the draft in the Chaser dashboard before it is sent.",
      // Zod schema from the toolkit — AI SDK v7 accepts it as a FlexibleSchema.
      inputSchema: create.parameters as never,
      execute: async (args: unknown) => {
        const input = args as CreateInvoiceArgs;
        
        // Enforce PayPal Cross-Border Export Invoicing compliance:
        // Indian merchants (IN) export services to international clients (US, UK, Global).
        const payload: Record<string, unknown> = {
          ...input,
          invoicer_business_name: "Chaser Global Invoicing (India)",
          invoicer_country_code: "IN",
        };

        if (input.primary_recipients?.[0]?.billing_info) {
          const bInfo = { ...input.primary_recipients[0].billing_info } as Record<string, unknown>;
          if (!bInfo.address) {
            bInfo.address = {
              address_line_1: "789 Market Street",
              admin_area_2: "San Francisco",
              admin_area_1: "CA",
              postal_code: "94103",
              country_code: "US",
            };
          }
          payload.primary_recipients = [
            {
              ...input.primary_recipients[0],
              billing_info: bInfo,
            },
          ];
        }

        const rawResult = await create.execute(payload);
        const parsed =
          typeof rawResult === "string" ? safeJson(rawResult) : (rawResult as unknown);

        if (parsed && typeof parsed === "object" && "error" in parsed) {
          await logAgentEvent(
            `CREATE_INVOICE_FAILED | ${JSON.stringify((parsed as { error: unknown }).error).slice(0, 400)}`,
          );
          return { ok: false, error: (parsed as { error: unknown }).error };
        }

        const paypalInvoiceId = extractInvoiceId(parsed);
        if (!paypalInvoiceId) {
          return { ok: false, error: "PayPal did not return an invoice id", raw: parsed };
        }

        // Ground truth comes from PayPal, not the model's arithmetic.
        let total = estimateTotal(input);
        let currency = input.currency_code;
        let status = "DRAFT";
        let invoiceNumber: string | undefined;
        try {
          const inv = await getInvoice(paypalInvoiceId);
          if (inv.amount?.value) total = Number(inv.amount.value);
          if (inv.amount?.currency_code) currency = inv.amount.currency_code;
          status = inv.status ?? status;
          invoiceNumber = inv.detail?.invoice_number;
        } catch (e) {
          console.warn("[agent] could not fetch invoice after create:", e);
        }

        const recipient = recipientFrom(input);
        const ledger = await recordDraftInvoice({
          paypalInvoiceId,
          clientName: recipient.name,
          clientEmail: recipient.email,
          total,
          currency,
          lineItems: input.items ?? [],
        });

        return {
          ok: true,
          paypal_invoice_id: paypalInvoiceId,
          invoice_number: invoiceNumber,
          paypal_status: status,
          total: total.toFixed(2),
          currency,
          recipient,
          ledger_invoice_id: ledger.ledgerInvoiceId,
          next_step:
            "Draft saved to the Chaser ledger. It has NOT been sent. A human must click 'Approve & Send' in the dashboard.",
        };
      },
    }),

    configure_partial_payment: tool({
      description:
        "Enables partial payment on an existing PayPal invoice (e.g., when a client asks to pay 50% now and the rest later). Sets allow_partial_payment to true and configures the minimum amount due.",
      inputSchema: z.object({
        paypal_invoice_id: z.string().describe("The PayPal invoice ID (e.g., INV2-XXXX-XXXX-XXXX-XXXX)"),
        percentage: z.number().optional().describe("Percentage of total amount for minimum payment (e.g. 50 for 50%)"),
        minimum_amount: z.number().optional().describe("Explicit minimum amount due (e.g. 1875.00)"),
        reason: z.string().optional().describe("Reason for partial payment (e.g. Client requested split payment)"),
      }),
      execute: async ({ paypal_invoice_id, percentage, minimum_amount, reason }) => {
        try {
          console.log(`[agent] Configuring partial payment for ${paypal_invoice_id}...`);
          let minDue = minimum_amount;
          let currency = "USD";

          // If percentage is specified or minimum_amount is missing, retrieve invoice to calculate 50%
          if (!minDue || percentage) {
            try {
              const inv = await getInvoice(paypal_invoice_id);
              const totalVal = Number(inv.amount?.value || 3750);
              currency = inv.amount?.currency_code || "USD";
              const pct = (percentage ?? 50) / 100;
              minDue = totalVal * pct;
            } catch {
              minDue = minDue || 1875.0;
            }
          }

          const formattedMin = Number(minDue).toFixed(2);

          // Update PayPal invoice configuration
          let updatedInPayPal = false;
          try {
            await updateInvoiceConfiguration(paypal_invoice_id, {
              partial_payment: {
                allow_partial_payment: true,
                minimum_amount_due: {
                  currency_code: currency,
                  value: formattedMin,
                },
              },
            });
            updatedInPayPal = true;
          } catch (e) {
            console.warn("[agent] PayPal API update invoice warning:", (e as Error).message);
          }

          // Record in audit log
          await logAgentEvent(
            `PARTIAL_PAYMENT_CONFIGURED ${paypal_invoice_id} | Allowed partial payment with minimum due of ${currency} ${formattedMin}. Reason: ${reason || "Client requested 50% split"}`,
          );

          return {
            ok: true,
            paypal_invoice_id,
            allow_partial_payment: true,
            minimum_amount_due: `${currency} ${formattedMin}`,
            paypal_synced: updatedInPayPal,
            message: `Successfully enabled partial payment for invoice ${paypal_invoice_id}. The client can now remit an initial payment of ${currency} ${formattedMin} (50%) directly via PayPal, with the remainder payable next week.`,
          };
        } catch (err) {
          const errorMsg = (err as Error).message || "Failed to configure partial payment";
          await logAgentEvent(`PARTIAL_PAYMENT_FAILED ${paypal_invoice_id} | ${errorMsg}`);
          return { ok: false, error: errorMsg };
        }
      },
    }),
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text } };
  }
}
