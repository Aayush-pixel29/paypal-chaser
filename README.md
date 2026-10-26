# Chaser — Autonomous Accounts Receivable & Zero-Trust Invoicing Workspace

> Built for the **PayPal AI Agent & AG Grid Hackathon**.  
> An autonomous financial operations workspace that turns unstructured client statements of work (SOWs), contracts, and emails into structured invoices, dispatches them through the **PayPal Invoicing API v2**, and manages overdue collections with strict **Human-In-The-Loop (HITL) Zero-Trust guards**.

---

## 🏛️ Executive Summary & Architectural Integrity

Financial agents must never possess unconstrained write authority over live payment channels. In Chaser, the AI Agent's OAuth scope is strictly limited to drafting:
```
AI Agent Scope: create_invoice (Drafts Only)
Human Operator Scope: send_invoice, update_configuration, remind_invoice
```

### The Zero-Trust Protocol:
1. **AI Proposes, Human Authorizes:** The AI agent (powered by Gemini 2.5 Flash via AI SDK v7) can extract client data and generate draft invoices. However, it cannot dispatch money requests or mutate live customer obligations directly.
2. **Propose-and-Review Splits:** When a customer requests payment arrangements ("Can I pay 50% now?"), the agent generates a proposal (`propose_partial_payment`) staged in the Supabase audit ledger. An operator reviews and approves the arrangement directly in **AG Grid**.
3. **Session-Scoped Operator Auth & CSRF:** No login wall blocks judges from testing. Instead, Next.js Edge Proxy automatically issues a signed session cookie (`chaser_operator_token`) and validates `x-chaser-csrf` headers on all mutating POST routes (`/api/invoices/*`, `/api/ledger/seed`), rejecting unauthorized external requests with `401 Unauthorized`.
4. **Fail-Closed PayPal Webhook State Machine:** Inbound PayPal webhooks are cryptographically verified against PayPal's verification endpoint. Unsigned requests fail immediately with `401`. Events are processed idempotently (`webhook_events`), and state updates follow a forward-only state machine:
   $$\text{DRAFT (1)} \rightarrow \text{SENT (2)} \rightarrow \text{OVERDUE (3)} \rightarrow \text{PARTIALLY\_PAID (4)} \rightarrow \text{PAID (5)}$$
   Delayed or replayed webhooks can never overwrite a settled invoice.

---

## ⚡ Key Highlights for Judges

| Focus Area | Capability | Implementation Details |
|---|---|---|
| **PayPal Invoicing API** | 100% Live Sandbox Coverage | Every seeded row (*Acme Global Robotics*, *TechVentures Cloud*, *Nordic Design Studio*, *Apex AI Solutions*) corresponds to an active PayPal Sandbox invoice. Zero 404 links. |
| **AG Grid v36** | Advanced Financial Workspace | Master/Detail expandable row chevrons, visual Payment Progress aging bars, currency formatting, custom cell renderers, and realtime Supabase sync. |
| **AI Extraction** | Split SOW Workbench | Monospace document viewer and real-time schema extraction preview with Zod validation before drafting. |
| **Auditability** | Cryptographic Activity Trail | Realtime chronological event feed tracking every actor (`AI_AGENT`, `HUMAN_OPERATOR`, `PAYPAL_WEBHOOK`). |

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16.4.3 (Turbopack, App Router, Route Handlers, Edge Proxy)
- **AI Engine:** Google Gemini 2.5 Flash (`@ai-sdk/google`, AI SDK v7, custom tool definitions with Zod schemas)
- **Payment Gateway:** PayPal Invoicing API v2 (`/v2/invoicing/invoices`, OAuth 2.0 Client Credentials, Sandbox Mode)
- **Data Table:** AG Grid 36 (`ag-grid-react`, `ag-grid-community`, dark theme, custom cell renderers, Master/Detail)
- **Database & Realtime:** Supabase (PostgreSQL, Realtime change stream, resilient auto-adapting queries)
- **Design System:** Vanilla CSS + Tailwind-compatible dark glassmorphism, monochrome `lucide-react` iconography

---

## 🚀 Quickstart & Local Setup

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Aayush-pixel29/paypal-chaser.git
cd chaser
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and add your API credentials:
```env
# PayPal Sandbox Credentials (from developer.paypal.com)
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_ENVIRONMENT=SANDBOX
PAYPAL_WEBHOOK_ID=your_paypal_webhook_id

# Supabase (Database & Realtime)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google Gemini (from aistudio.google.com)
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

### 3. Database Migration (Supabase)
Run the SQL migration in `supabase/schema_v2.sql` inside your Supabase project's SQL Editor:
- Creates `webhook_events` for replay defense.
- Adds `currency`, `payer_view_url`, and `proposed_min_amount` columns.
- Locks down public write access on clients/invoices/logs while preserving Realtime read streams.

*(Note: Chaser includes resilient database fallback functions, so the app will function cleanly even before running the v2 migration).*

### 4. Run the Dev Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Judge Testing Walkthrough

### Test 1: Live Demo Ledger Seed (Zero 404s)
1. Click **"Reset Demo Ledger"** in the top navigation bar.
2. Observe 4 live invoices generated directly in your PayPal Sandbox account across all lifecycle states:
   - **Acme Global Robotics** (`DRAFT`, $3,750.00)
   - **TechVentures Cloud Inc** (`SENT`, $6,400.00)
   - **Nordic Design Studio** (`OVERDUE`, $2,850.00)
   - **Apex AI Solutions US** (`PAID`, $5,200.00)
3. Click **"View ↗"** on any row — it links directly to the genuine PayPal Sandbox invoice.
4. Click **"Copy Pay Link"** — copies the authentic PayPal checkout link.

### Test 2: AI SOW Extraction & Human-In-The-Loop Send
1. In the left-hand **Split SOW Workbench**, click the **"+ US Agency SOW"** contract pill.
2. Review the monospace client contract and the extracted line items.
3. Click **"Draft Invoice with Gemini"**. The AI extracts billing details and creates a draft in PayPal Sandbox.
4. In AG Grid, the new invoice appears in `DRAFT` state with an amber button: **"Approve & Send"**.
5. Click **"Approve & Send"**. The server route dispatches the invoice to PayPal and flips the status to `SENT`.

### Test 3: Zero-Trust Partial Payment Proposal
1. Click the **"+ 50% Split Request"** prompt card in the chat pane.
2. Ask Gemini: *"TechVentures asked if they can pay 50% now and the rest next month. Can we configure that?"*
3. The AI agent executes `propose_partial_payment`. Notice that it does **not** mutate PayPal directly.
4. In AG Grid, the row displays an **"Approve Split ($3,200 min)"** badge.
5. The human operator clicks to approve, executing the verified partial payment update.

### Test 4: Autonomous Tone-Escalating Chaser
1. On the `OVERDUE` row (*Nordic Design Studio*), click **"AI Escalate & Remind"**.
2. Select the tone (Firm / Final Notice) and click **"Dispatch Reminder"**.
3. PayPal Invoicing API `/v2/invoicing/invoices/{id}/remind` executes, returning `HTTP 204 No Content` and logging the event in the Realtime Activity Trail.

---

## 🔒 Security & Verification Proofs

| Attack Vector | Defense Mechanism | Verified Result |
|---|---|---|
| **Forged Webhook Poisoning** | Cryptographic verification header checks + fail-closed validation | HTTP 401 Unauthorized |
| **External API Tampering** | Edge session-scoped operator token + `x-chaser-csrf` check | HTTP 401 Unauthorized |
| **Replay Attacks** | `webhook_events` primary key deduplication | Replay ignored |
| **State Regressions** | Forward-only rank validation (`DRAFT -> SENT -> OVERDUE -> PAID`) | Regressions blocked |
| **Bogus Ledger IDs** | Strict row count verification before response | HTTP 404 Invoice not found |

---

## 📄 License
MIT License. Built with ❤️ for PayPal & AG Grid.
