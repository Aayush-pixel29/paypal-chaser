import "server-only";
import { randomUUID } from "node:crypto";
import {
  getSupabase,
  resilientInsert,
  resilientUpdate,
  type AgentLogRow,
  type InvoiceRow,
} from "./supabase";

/**
 * The HITL ledger. All writes here are deterministic code, never the LLM.
 * Built with dual-layer resilience: writes to Supabase, but falls back gracefully
 * to an in-memory ledger if Supabase RLS policies are locked.
 */

export interface LedgerInvoice extends InvoiceRow {
  clients: { name: string | null; email: string | null } | null;
}

// In-memory ledger cache for zero-downtime resilience
const inMemoryClients = new Map<string, { id: string; name: string | null; email: string | null }>();
const inMemoryInvoices = new Map<string, LedgerInvoice>();
const inMemoryLogs: AgentLogRow[] = [];

export async function findOrCreateClient(input: {
  name: string | null;
  email: string | null;
}): Promise<string> {
  const db = getSupabase();
  try {
    if (input.email) {
      const { data, error } = await db
        .from("clients")
        .select("id")
        .eq("email", input.email)
        .limit(1)
        .maybeSingle();
      if (!error && data?.id) return data.id as string;
    }
    const id = randomUUID();
    const { error } = await db
      .from("clients")
      .insert({ id, name: input.name, email: input.email });
    if (!error) return id;
    console.warn("[ledger] Supabase clients write restricted, using fallback:", error.message);
  } catch (err) {
    console.warn("[ledger] Supabase clients lookup exception:", (err as Error).message);
  }

  const id = randomUUID();
  inMemoryClients.set(id, { id, name: input.name, email: input.email });
  return id;
}

export interface DraftRecord {
  paypalInvoiceId: string;
  clientName: string | null;
  clientEmail: string | null;
  total: number;
  currency: string;
  lineItems: unknown[];
}

export async function recordDraftInvoice(draft: DraftRecord) {
  const clientId = await findOrCreateClient({
    name: draft.clientName,
    email: draft.clientEmail,
  });

  const invoiceId = randomUUID();
  const newRow: LedgerInvoice = {
    id: invoiceId,
    paypal_invoice_id: draft.paypalInvoiceId,
    client_id: clientId,
    total_amount: draft.total,
    currency: draft.currency || "USD",
    payer_view_url: `https://www.sandbox.paypal.com/invoice/p/#${draft.paypalInvoiceId}`,
    status: "DRAFT",
    line_items: draft.lineItems,
    clients: { name: draft.clientName, email: draft.clientEmail },
    created_at: new Date().toISOString(),
  };

  try {
    const { error: invErr } = await resilientInsert("invoices", {
      id: invoiceId,
      paypal_invoice_id: draft.paypalInvoiceId,
      client_id: clientId,
      total_amount: draft.total,
      currency: draft.currency || "USD",
      status: "DRAFT",
      line_items: draft.lineItems,
    });
    if (invErr) console.warn("[ledger] Supabase invoices insert restricted, using resilient cache:", invErr.message);
  } catch (err) {
    console.warn("[ledger] Invoices insert exception:", (err as Error).message);
  }

  // Always store in inMemoryInvoices so UI and AG Grid immediately reflect it
  inMemoryInvoices.set(draft.paypalInvoiceId, newRow);

  const logId = randomUUID();
  const action = `SEND_INVOICE ${draft.paypalInvoiceId} | ${draft.currency} ${draft.total.toFixed(
    2,
  )} → ${draft.clientEmail ?? "unknown recipient"}`;

  const logRow: AgentLogRow = {
    id: logId,
    invoice_id: draft.paypalInvoiceId,
    actor: "AI_AGENT",
    action_proposed: action,
    approved: false,
    timestamp: new Date().toISOString(),
  };

  try {
    const { error: logErr } = await resilientInsert("agent_logs", logRow);
    if (logErr) console.warn("[ledger] Supabase agent_logs insert restricted, using resilient cache:", logErr.message);
  } catch (err) {
    console.warn("[ledger] Agent logs insert exception:", (err as Error).message);
  }

  inMemoryLogs.unshift(logRow);

  return { ledgerInvoiceId: invoiceId, clientId, agentLogId: logId };
}

export async function logAgentEvent(action: string, invoiceId?: string, actor = "AI_AGENT") {
  const logRow: AgentLogRow = {
    id: randomUUID(),
    invoice_id: invoiceId || null,
    actor,
    action_proposed: action,
    approved: false,
    timestamp: new Date().toISOString(),
  };
  try {
    const { error } = await resilientInsert("agent_logs", logRow);
    if (error) console.warn("[ledger] agent_logs insert restricted:", error.message);
  } catch {}
  inMemoryLogs.unshift(logRow);
}

export async function updateInvoiceStatus(
  paypalInvoiceId: string,
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED",
) {
  let updatedInDb = false;
  try {
    const db = getSupabase();
    const { data, error } = await db
      .from("invoices")
      .update({ status })
      .eq("paypal_invoice_id", paypalInvoiceId)
      .select();
    if (!error && data && data.length > 0) updatedInDb = true;
  } catch (err) {
    console.warn("[ledger] Supabase updateInvoiceStatus exception:", (err as Error).message);
  }

  const existing = inMemoryInvoices.get(paypalInvoiceId);
  if (existing) {
    existing.status = status;
    inMemoryInvoices.set(paypalInvoiceId, existing);
    return [existing];
  }

  if (!updatedInDb && !existing) {
    throw new Error(`Invoice ${paypalInvoiceId} not found in ledger`);
  }
  return [{ paypal_invoice_id: paypalInvoiceId, status }];
}

export async function proposePartialPayment(
  paypalInvoiceId: string,
  minAmount: number,
  reason?: string,
) {
  const existingMem = inMemoryInvoices.get(paypalInvoiceId);
  if (existingMem) {
    existingMem.proposed_min_amount = minAmount;
    inMemoryInvoices.set(paypalInvoiceId, existingMem);
  }

  try {
    await resilientUpdate(
      "invoices",
      { proposed_min_amount: minAmount },
      "paypal_invoice_id",
      paypalInvoiceId
    );
  } catch (err) {
    console.warn("[ledger] Supabase proposePartialPayment exception:", (err as Error).message);
  }

  const logId = randomUUID();
  const action = `PARTIAL_PAYMENT_PROPOSED ${paypalInvoiceId} | Proposed min due: $${minAmount.toFixed(
    2,
  )}${reason ? ` (${reason})` : ""}`;

  const logRow: AgentLogRow = {
    id: logId,
    invoice_id: paypalInvoiceId,
    actor: "AI_AGENT",
    action_proposed: action,
    approved: false,
    timestamp: new Date().toISOString(),
  };

  try {
    await resilientInsert("agent_logs", logRow);
  } catch {}

  inMemoryLogs.unshift(logRow);

  return { success: true, paypalInvoiceId, proposedMinAmount: minAmount };
}

export async function logWebhookEvent(
  action: string,
  approved = true,
  invoiceId?: string,
  actor = "PAYPAL_WEBHOOK",
) {
  const logRow: AgentLogRow = {
    id: randomUUID(),
    invoice_id: invoiceId || null,
    actor,
    action_proposed: action,
    approved,
    timestamp: new Date().toISOString(),
  };
  try {
    const { error } = await resilientInsert("agent_logs", logRow);
    if (error) console.warn("[ledger] webhook agent_logs insert restricted:", error.message);
  } catch {}
  inMemoryLogs.unshift(logRow);
}

export async function markLogApproved(paypalInvoiceId: string) {
  try {
    const db = getSupabase();
    await db
      .from("agent_logs")
      .update({ approved: true })
      .or(`invoice_id.eq.${paypalInvoiceId},action_proposed.ilike.%${paypalInvoiceId}%`);
  } catch {}

  for (const l of inMemoryLogs) {
    if (l.invoice_id === paypalInvoiceId || l.action_proposed.includes(paypalInvoiceId)) {
      l.approved = true;
    }
  }
}

export async function listInvoices(): Promise<LedgerInvoice[]> {
  try {
    const { data, error } = await getSupabase()
      .from("invoices")
      .select("*, clients(name, email)");
    if (!error && data) {
      const dbIds = new Set(data.map((i) => i.paypal_invoice_id));
      const memoryOnly = Array.from(inMemoryInvoices.values()).filter(
        (i) => i.paypal_invoice_id && !dbIds.has(i.paypal_invoice_id)
      );
      return [...data, ...memoryOnly] as LedgerInvoice[];
    }
  } catch (err) {
    console.warn("[ledger] Supabase listInvoices failed, returning in-memory:", (err as Error).message);
  }
  return Array.from(inMemoryInvoices.values());
}

export async function listAgentLogs(limit = 25): Promise<AgentLogRow[]> {
  try {
    const { data, error } = await getSupabase()
      .from("agent_logs")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);
    if (!error && data) {
      const dbIds = new Set(data.map((l) => l.id));
      const memoryOnly = inMemoryLogs.filter((l) => !dbIds.has(l.id));
      return [...memoryOnly, ...data].slice(0, limit) as AgentLogRow[];
    }
  } catch (err) {
    console.warn("[ledger] Supabase listAgentLogs failed, returning in-memory:", (err as Error).message);
  }
  return inMemoryLogs.slice(0, limit);
}
