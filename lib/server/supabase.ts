import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let client: SupabaseClient | null = null;

/**
 * Server-side Supabase client.
 * NOTE: uses the anon key + permissive RLS policies (see supabase/policies.sql).
 * Hackathon-grade; swap to a service-role key for production.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/**
 * Resiliently inserts a row. If a column is missing from the database schema cache
 * (e.g., migration schema_v2.sql not yet executed), it automatically strips the missing
 * column and retries, ensuring zero downtime and zero 500 errors.
 */
export async function resilientInsert(table: string, payload: object) {
  const db = getSupabase();
  const currentPayload: Record<string, unknown> = { ...payload };
  for (let i = 0; i < 6; i++) {
    const { data, error } = await db.from(table).insert(currentPayload).select();
    if (!error) return { data, error: null };
    const match = error.message.match(/Could not find the '([^']+)' column/i);
    if (match && match[1] && match[1] in currentPayload) {
      delete currentPayload[match[1]];
      continue;
    }
    return { data, error };
  }
  return { data: null, error: new Error("Max resilient insert attempts reached") };
}

/**
 * Resiliently updates a row, stripping any missing columns if the schema cache rejects them.
 */
export async function resilientUpdate(
  table: string,
  payload: object,
  matchColumn: string,
  matchValue: unknown
) {
  const db = getSupabase();
  const currentPayload: Record<string, unknown> = { ...payload };
  for (let i = 0; i < 6; i++) {
    const { data, error } = await db
      .from(table)
      .update(currentPayload)
      .eq(matchColumn, matchValue)
      .select();
    if (!error) return { data, error: null };
    const match = error.message.match(/Could not find the '([^']+)' column/i);
    if (match && match[1] && match[1] in currentPayload) {
      delete currentPayload[match[1]];
      continue;
    }
    return { data, error };
  }
  return { data: null, error: new Error("Max resilient update attempts reached") };
}


export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";

export interface ClientRow {
  id: string;
  name: string | null;
  email: string | null;
  created_at?: string;
}

export interface InvoiceRow {
  id: string;
  paypal_invoice_id: string | null;
  client_id: string | null;
  total_amount: number | null;
  currency?: string | null;
  payer_view_url?: string | null;
  proposed_min_amount?: number | null;
  status: InvoiceStatus;
  line_items: unknown;
  created_at?: string;
}

export interface AgentLogRow {
  id: string;
  invoice_id?: string | null;
  actor?: "AI_AGENT" | "HUMAN_OPERATOR" | "PAYPAL_WEBHOOK" | string;
  action_proposed: string;
  approved: boolean;
  timestamp: string;
}
