import { randomUUID } from "node:crypto";
import { getSupabase } from "@/lib/server/supabase";
import { findOrCreateClient } from "@/lib/server/ledger";

export const maxDuration = 60;

/**
 * Demo Ledger Seeder:
 * Cleans up duplicate draft test rows and seeds 4 realistic production clients
 * in distinct states: DRAFT, SENT, OVERDUE, and PAID.
 * Satisfies the AG Grid $5,000 prize tier requirement.
 */
export async function POST() {
  try {
    const db = getSupabase();

    // 1. Delete existing test invoices and logs to provide a clean demo slate
    await db.from("invoices").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await db.from("agent_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 2. Define realistic sample clients using findOrCreateClient
    const client1Id = await findOrCreateClient({
      name: "Acme Global Robotics",
      email: "sb-lfyee53530704@personal.example.com",
    });

    const client2Id = await findOrCreateClient({
      name: "TechVentures Cloud Inc",
      email: "sarah.j@techventures.io",
    });

    const client3Id = await findOrCreateClient({
      name: "Nordic Design Studio",
      email: "lukas@nordicdesign.co",
    });

    const client4Id = await findOrCreateClient({
      name: "Apex AI Solutions US",
      email: "d.miller@apexai.us",
    });

    // 3. Define 4 invoices in distinct states
    const invoicesData = [
      {
        id: randomUUID(),
        paypal_invoice_id: "INV2-72AT-G5P8-GL4K-8FLQ",
        client_id: client1Id,
        total_amount: 3750.0,
        status: "DRAFT",
        line_items: [
          {
            name: "Landing page redesign",
            quantity: "24",
            unit_amount: { currency_code: "USD", value: "85.00" },
            unit_of_measure: "HOURS",
          },
          {
            name: "Design system in Figma",
            quantity: "1",
            unit_amount: { currency_code: "USD", value: "1200.00" },
            unit_of_measure: "QUANTITY",
          },
          {
            name: "Revisions round",
            quantity: "6",
            unit_amount: { currency_code: "USD", value: "85.00" },
            unit_of_measure: "HOURS",
          },
        ],
      },
      {
        id: randomUUID(),
        paypal_invoice_id: "INV2-TVCL-9204-KLP9-82QA",
        client_id: client2Id,
        total_amount: 6400.0,
        status: "SENT",
        line_items: [
          {
            name: "AWS Multi-Region Migration & Security Audit",
            quantity: "40",
            unit_amount: { currency_code: "USD", value: "160.00" },
            unit_of_measure: "HOURS",
          },
        ],
      },
      {
        id: randomUUID(),
        paypal_invoice_id: "INV2-NRDC-3810-DFP4-90XA",
        client_id: client3Id,
        total_amount: 2850.0,
        status: "OVERDUE",
        line_items: [
          {
            name: "Brand Identity, Typography & Visual Guidelines",
            quantity: "1",
            unit_amount: { currency_code: "USD", value: "2850.00" },
            unit_of_measure: "QUANTITY",
          },
        ],
      },
      {
        id: randomUUID(),
        paypal_invoice_id: "INV2-8FSD-3HT6-BRHR-UHYV",
        client_id: client4Id,
        total_amount: 5200.0,
        status: "PAID",
        line_items: [
          {
            name: "Agentic Invoicing Workflow Integration & Zod Validation",
            quantity: "1",
            unit_amount: { currency_code: "USD", value: "5200.00" },
            unit_of_measure: "QUANTITY",
          },
        ],
      },
    ];

    for (const inv of invoicesData) {
      const { error: invErr } = await db.from("invoices").insert(inv);
      if (invErr) {
        console.error("[seed] invoice insert failed:", invErr);
        throw invErr;
      }
    }

    // 4. Insert rich Zero-Trust immutable audit trail
    const logs = [
      {
        id: randomUUID(),
        action_proposed: "PAYMENT_VERIFIED INV2-8FSD-3HT6-BRHR-UHYV | Settled $5,200.00 via PayPal Webhook with verified signature",
        approved: true,
      },
      {
        id: randomUUID(),
        action_proposed: "STATUS_ESCALATED INV2-NRDC-3810-DFP4-90XA | Marked 7 Days OVERDUE (Autonomous Chaser Triggered)",
        approved: true,
      },
      {
        id: randomUUID(),
        action_proposed: "HUMAN_APPROVED INV2-TVCL-9204-KLP9-82QA | Dispatched to recipient via PayPal API",
        approved: true,
      },
      {
        id: randomUUID(),
        action_proposed: "SEND_INVOICE INV2-72AT-G5P8-GL4K-8FLQ | USD 3750.00 → sb-lfyee53530704@personal.example.com",
        approved: false,
      },
    ];

    for (const l of logs) {
      await db.from("agent_logs").insert(l);
    }

    return Response.json({
      success: true,
      message: "Seeded 4 realistic clients across DRAFT, SENT, OVERDUE, and PAID states.",
      invoices: invoicesData.length,
    });
  } catch (err) {
    console.error("[seed] Error resetting demo ledger:", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
