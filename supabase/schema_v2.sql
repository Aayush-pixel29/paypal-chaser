-- Chaser — Schema V2: Production Hardening, Audit Trail, and Strict Zero-Trust RLS
-- Run in the Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Clean up test side-effects from the security audit
DELETE FROM agent_logs 
WHERE action_proposed ILIKE '%INV2-DOES-NOT-EXIST%' 
   OR action_proposed ILIKE '%INV2-FORGED-AUDIT-TEST%';

-- 2. Upgrade schema for production correctness
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_email ON clients(email) WHERE email IS NOT NULL;

ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS payer_view_url TEXT,
  ADD COLUMN IF NOT EXISTS proposed_min_amount DECIMAL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE agent_logs 
  ADD COLUMN IF NOT EXISTS invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS actor TEXT DEFAULT 'AI_AGENT'; -- 'AI_AGENT', 'HUMAN_OPERATOR', 'PAYPAL_WEBHOOK'

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  paypal_invoice_id TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Lock down RLS:
-- Browser (anon) can ONLY read for Realtime; only Service Role / Server can mutate.
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chaser_anon_all_clients" ON clients;
DROP POLICY IF EXISTS "chaser_anon_all_invoices" ON invoices;
DROP POLICY IF EXISTS "chaser_anon_all_agent_logs" ON agent_logs;
DROP POLICY IF EXISTS "Allow public write clients" ON clients;
DROP POLICY IF EXISTS "Allow public write invoices" ON invoices;
DROP POLICY IF EXISTS "Allow public write agent_logs" ON agent_logs;

-- Read-only policies for anonymous client realtime subscription
DROP POLICY IF EXISTS "chaser_anon_read_clients" ON clients;
CREATE POLICY "chaser_anon_read_clients" ON clients FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "chaser_anon_read_invoices" ON invoices;
CREATE POLICY "chaser_anon_read_invoices" ON invoices FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "chaser_anon_read_agent_logs" ON agent_logs;
CREATE POLICY "chaser_anon_read_agent_logs" ON agent_logs FOR SELECT TO anon USING (true);
