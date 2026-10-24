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
    client = createClient(env.supabase.url, env.supabase.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";

export interface ClientRow {
  id: string;
  name: string | null;
  email: string | null;
}

export interface InvoiceRow {
  id: string;
  paypal_invoice_id: string | null;
  client_id: string | null;
  total_amount: number | null;
  status: InvoiceStatus;
  line_items: unknown;
}

export interface AgentLogRow {
  id: string;
  action_proposed: string;
  approved: boolean;
  timestamp: string;
}
