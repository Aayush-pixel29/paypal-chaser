"use client";

import { useState } from "react";

export function SecurityArchitectureModal() {
  const [open, setOpen] = useState(false);
  const [activeLayer, setActiveLayer] = useState<"gateway" | "injection" | "integrity" | "audit">("gateway");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium text-ink transition hover:border-accent/60 hover:shadow-lg"
      >
        <span className="text-accent animate-pulse">🛡️</span> Zero-Trust Architecture
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-up">
      <div className="glass max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-line-strong p-6 md:p-8 shadow-2xl scroll-slim">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-accent/20 px-2.5 py-1 font-mono text-xs font-semibold text-accent ring-1 ring-accent/30">
                ZERO-TRUST AGENTIC COMMERCE
              </span>
              <span className="rounded-lg bg-success/20 px-2.5 py-1 font-mono text-xs font-semibold text-success ring-1 ring-success/30">
                COMPLIANT HITL
              </span>
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
              Secure Request &amp; HITL Architecture
            </h2>
            <p className="mt-1 text-xs text-muted">
              Interactive flow mapping LLM validation gates, approval workflows, and PayPal APIs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl border border-line-strong p-2 text-muted hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Interactive Diagram */}
        <div className="my-6 rounded-2xl border border-line-strong bg-bg-elev/90 p-6 shadow-inner">
          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6 text-center text-xs">
            {/* Step 1 */}
            <div className="flex flex-col items-center">
              <div className="rounded-2xl border border-line bg-black/60 px-4 py-3 shadow">
                <div className="text-muted text-[10px]">UNTRUSTED INPUT</div>
                <div className="font-semibold text-ink">Chat / SOW Message</div>
              </div>
              <span className="mt-2 text-[10px] text-muted">Untrusted text ➔</span>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center">
              <div className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 shadow">
                <div className="text-accent text-[10px]">PROMPT ISOLATION</div>
                <div className="font-semibold text-white">Gemini 2.5 Flash</div>
                <div className="text-[10px] text-muted">Scope: create_invoice only</div>
              </div>
              <span className="mt-2 text-[10px] text-muted">JSON Schema ➔</span>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center">
              <div className="rounded-2xl border border-success/40 bg-success/10 px-4 py-3 shadow">
                <div className="text-success text-[10px]">SCHEMA VALIDATOR</div>
                <div className="font-semibold text-white">Zod Engine</div>
                <div className="text-[10px] text-muted">Type &amp; bounds checking</div>
              </div>
              <span className="mt-2 text-[10px] text-muted">Enqueue ➔</span>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center">
              <div className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 shadow">
                <div className="text-warning text-[10px]">PENDING QUEUE</div>
                <div className="font-semibold text-white">Supabase Ledger</div>
                <div className="text-[10px] text-muted">DRAFT · Air-gapped</div>
              </div>
              <span className="mt-2 text-[10px] text-muted">Review &amp; Poll ➔</span>
            </div>

            {/* Step 5 */}
            <div className="flex flex-col items-center">
              <div className="rounded-2xl border border-accent-2/60 bg-accent-2/20 px-4 py-3 shadow ring-2 ring-accent-2/40">
                <div className="text-accent-2 text-[10px] font-bold">HITL GATE</div>
                <div className="font-semibold text-white">AG Grid Review</div>
                <div className="text-[10px] text-accent-2">Human &quot;Approve &amp; Send&quot;</div>
              </div>
              <span className="mt-2 text-[10px] text-muted">Approve ➔</span>
            </div>

            {/* Step 6 */}
            <div className="flex flex-col items-center">
              <div className="rounded-2xl border border-line bg-black/60 px-4 py-3 shadow">
                <div className="text-muted text-[10px]">EXECUTION ENGINE</div>
                <div className="font-semibold text-ink">PayPal Sandbox API</div>
                <div className="text-[10px] text-muted">/v2/invoicing/send</div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 border-t border-line/60 pt-3 text-[11px] text-muted">
            <span className="h-2 w-2 rounded-full bg-success"></span>
            <span>Cryptographic Webhook Ground-Truth: PayPal ➔ <code className="font-mono text-ink">/api/webhooks/paypal</code> ➔ Sets Status: PAID in Supabase</span>
          </div>
        </div>

        {/* 4 Pillars Tabs */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setActiveLayer("gateway")}
            className={`rounded-xl p-3 text-left transition ${
              activeLayer === "gateway"
                ? "border border-accent/50 bg-accent/15 text-white"
                : "border border-line bg-bg-elev/50 text-muted hover:text-ink"
            }`}
          >
            <div className="font-semibold text-xs">1. HITL Gateway</div>
            <div className="text-[11px] opacity-75">EU AI Act (Art 14)</div>
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer("injection")}
            className={`rounded-xl p-3 text-left transition ${
              activeLayer === "injection"
                ? "border border-accent/50 bg-accent/15 text-white"
                : "border border-line bg-bg-elev/50 text-muted hover:text-ink"
            }`}
          >
            <div className="font-semibold text-xs">2. Anti-Injection</div>
            <div className="text-[11px] opacity-75">OWASP LLM01 Gate</div>
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer("integrity")}
            className={`rounded-xl p-3 text-left transition ${
              activeLayer === "integrity"
                ? "border border-accent/50 bg-accent/15 text-white"
                : "border border-line bg-bg-elev/50 text-muted hover:text-ink"
            }`}
          >
            <div className="font-semibold text-xs">3. Webhooks Sync</div>
            <div className="text-[11px] opacity-75">Anti-Hallucination</div>
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer("audit")}
            className={`rounded-xl p-3 text-left transition ${
              activeLayer === "audit"
                ? "border border-accent/50 bg-accent/15 text-white"
                : "border border-line bg-bg-elev/50 text-muted hover:text-ink"
            }`}
          >
            <div className="font-semibold text-xs">4. Immutable Audit</div>
            <div className="text-[11px] opacity-75">DORA &amp; NYDFS 500</div>
          </button>
        </div>

        {/* Pillar Details */}
        <div className="mt-4 rounded-2xl border border-line bg-bg-elev/60 p-5 text-sm text-ink/90 leading-relaxed">
          {activeLayer === "gateway" && (
            <div>
              <h4 className="font-semibold text-accent text-base">The Human-in-the-Loop Gateway (Compliance Layer)</h4>
              <p className="mt-1 text-xs text-muted">
                <strong>Mechanism:</strong> The AI model is strictly prohibited from holding dispatch or payment credentials. It can only propose drafts with <code className="font-mono text-ink">create_invoice</code>.
              </p>
              <p className="mt-2 text-xs">
                <strong>Legal &amp; Compliance Proof:</strong> Satisfies EU AI Act Article 14 and COSO internal control frameworks requiring active human oversight before financial execution.
              </p>
            </div>
          )}

          {activeLayer === "injection" && (
            <div>
              <h4 className="font-semibold text-accent text-base">Strict Schema Validation &amp; Scope Minimization</h4>
              <p className="mt-1 text-xs text-muted">
                <strong>Mechanism:</strong> All input is parsed through rigid Zod schemas. The PayPal OAuth credentials are minimized so payouts, refunds, and user modifications are completely disabled.
              </p>
              <p className="mt-2 text-xs">
                <strong>OWASP LLM01 Protection:</strong> Prevents indirect prompt injections from executing rogue payouts, unauthorized discounts, or canceling active invoices.
              </p>
            </div>
          )}

          {activeLayer === "integrity" && (
            <div>
              <h4 className="font-semibold text-accent text-base">Asynchronous State Management via PayPal Webhooks</h4>
              <p className="mt-1 text-xs text-muted">
                <strong>Mechanism:</strong> The AI is never trusted to know if an invoice is settled. Only cryptographically verified webhooks from PayPal (<code className="font-mono text-ink">INVOICING.INVOICE.PAID</code>) update the ledger.
              </p>
              <p className="mt-2 text-xs">
                <strong>CFPB UDAAP Defense:</strong> Eliminates hallucinations and protects against deceptive billing practices by grounding invoice states strictly in signed webhook events.
              </p>
            </div>
          )}

          {activeLayer === "audit" && (
            <div>
              <h4 className="font-semibold text-accent text-base">Immutable Audit Trails (Visibility Layer)</h4>
              <p className="mt-1 text-xs text-muted">
                <strong>Mechanism:</strong> Every single proposal generated by the AI and every human approval is recorded in Supabase <code className="font-mono text-ink">agent_logs</code> with precise timestamps.
              </p>
              <p className="mt-2 text-xs">
                <strong>Regulatory Resilience:</strong> Fully aligns with DORA (Digital Operational Resilience Act) and NYDFS Part 500 audit standards for financial automation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
