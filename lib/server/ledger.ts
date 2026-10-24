import "server-only";
import { randomUUID } from "node:crypto";
import { getSupabase, type AgentLogRow, type InvoiceRow } from "./supabase";

/**
 * The HITL ledger. All writes here are deterministic code, never the LLM.
 * Schema (Phase 2): clients, invoices, agent_logs — UUID PKs have no default,
 * so IDs are generated here.
 */

export async function findOrCreateClient(input: {
  name: string | null;
  email: string | null;
}): Promise<string> {
  const db = getSupabase();
  if (input.email) {
    const { data, error } = await db
      .from("clients")
      .select("id")
      .eq("email", input.email)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Supabase clients lookup failed: ${error.message}`);
    if (data?.id) return data.id as string;
  }
  const id = randomUUID();
  const { error } = await db
    .from("clients")
    .insert({ id, name: input.name, email: input.email });
  if (error) throw new Error(`Supabase clients insert failed: ${error.message}`);
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
  const db = getSupabase();
  const clientId = await findOrCreateClient({
    name: draft.clientName,
    email: draft.clientEmail,
  });

  const invoiceId = randomUUID();
  const { error: invErr } = await db.from("invoices").insert({
    id: invoiceId,
    paypal_invoice_id: draft.paypalInvoiceId,
    client_id: clientId,
    total_amount: draft.total,
    status: "DRAFT",
    line_items: draft.lineItems,
  });
  if (invErr) throw new Error(`Supabase invoices insert failed: ${invErr.message}`);

  // Proposed action awaiting a human. Machine-parsable prefix for Phase 5.
  const logId = randomUUID();
  const action = `SEND_INVOICE ${draft.paypalInvoiceId} | ${draft.currency} ${draft.total.toFixed(
    2,
  )} → ${draft.clientEmail ?? "unknown recipient"}`;
  const { error: logErr } = await db
    .from("agent_logs")
    .insert({ id: logId, action_proposed: action, approved: false });
  if (logErr) throw new Error(`Supabase agent_logs insert failed: ${logErr.message}`);

  return { ledgerInvoiceId: invoiceId, clientId, agentLogId: logId };
}

export async function logAgentEvent(action: string) {
  const { error } = await getSupabase()
    .from("agent_logs")
    .insert({ id: randomUUID(), action_proposed: action, approved: false });
  if (error) console.error("[ledger] agent_logs insert failed:", error.message);
}

export async function updateInvoiceStatus(
  paypalInvoiceId: string,
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED",
) {
  const db = getSupabase();
  const { data, error } = await db
    .from("invoices")
    .update({ status })
    .eq("paypal_invoice_id", paypalInvoiceId)
    .select();
  if (error) throw new Error(`Supabase invoices status update failed: ${error.message}`);
  return data;
}

export async function logWebhookEvent(action: string, approved = true) {
  const { error } = await getSupabase()
    .from("agent_logs")
    .insert({ id: randomUUID(), action_proposed: action, approved });
  if (error) console.error("[ledger] webhook agent_logs insert failed:", error.message);
}

export async function markLogApproved(paypalInvoiceId: string) {
  const db = getSupabase();
  const { error } = await db
    .from("agent_logs")
    .update({ approved: true })
    .ilike("action_proposed", `%${paypalInvoiceId}%`);
  if (error) console.error("[ledger] markLogApproved failed:", error.message);
}

export interface LedgerInvoice extends InvoiceRow {
  clients: { name: string | null; email: string | null } | null;
}

export async function listInvoices(): Promise<LedgerInvoice[]> {
  const { data, error } = await getSupabase()
    .from("invoices")
    .select("*, clients(name, email)");
  if (error) throw new Error(`Supabase invoices select failed: ${error.message}`);
  return (data ?? []) as LedgerInvoice[];
}

export async function listAgentLogs(limit = 25): Promise<AgentLogRow[]> {
  const { data, error } = await getSupabase()
    .from("agent_logs")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Supabase agent_logs select failed: ${error.message}`);
  return (data ?? []) as AgentLogRow[];
}
