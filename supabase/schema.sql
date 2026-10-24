-- Chaser — Phase 2 schema (as provisioned). Reference copy for judges/reproducibility.
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  name TEXT,
  email TEXT
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  paypal_invoice_id TEXT,
  client_id UUID REFERENCES clients(id),
  total_amount DECIMAL,
  status TEXT DEFAULT 'DRAFT', -- DRAFT, SENT, PAID, OVERDUE
  line_items JSONB
);

CREATE TABLE agent_logs ( -- The Activity Feed
  id UUID PRIMARY KEY,
  action_proposed TEXT,
  approved BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
