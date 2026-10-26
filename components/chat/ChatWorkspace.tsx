"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  MessageSquare,
  TableProperties,
  Sparkles,
  Send,
  StopCircle,
  FileText,
  ArrowRight,
  RotateCw,
} from "lucide-react";
import { DraftInvoiceCard, type DraftToolPart } from "./DraftInvoiceCard";
import { LedgerPanel } from "./LedgerPanel";
import { AGGridLedger, type LedgerInvoice } from "../dashboard/AGGridLedger";
import { SecurityArchitectureModal } from "../dashboard/SecurityArchitectureModal";

const SAMPLES = [
  {
    id: "us-agency",
    label: "+ US Agency SOW",
    client: "Acme Global Robotics (US)",
    currency: "USD",
    rate: "$85/hr + $1,200 fixed",
    totalEst: "$3,750.00",
    text: `Scope of work for Acme Global Robotics (billing contact: Jane Doe, sb-lfyee53530704@personal.example.com, 100 Montgomery St, San Francisco, CA 94104 US)
- Landing page redesign: 24 hours @ $85/hr
- Design system in Figma: flat fee $1,200
- 2 rounds of revisions: 6 hours @ $85/hr
Currency USD.`,
  },
  {
    id: "uk-freelance",
    label: "+ UK Freelance Chat",
    client: "Rohan Mehta (UK)",
    currency: "USD",
    rate: "3 concepts @ $150 + 4 hrs @ $60",
    totalEst: "$690.00",
    text: `bill Rohan Mehta (rohan.mehta.uk@example.com, London, UK) for the logo work — 3 concepts at 150 each plus 4 hours of edits at 60/hr in USD`,
  },
  {
    id: "partial-split",
    label: "+ 50% Split Request",
    client: "Acme Global Robotics",
    currency: "USD",
    rate: "50% upfront split",
    totalEst: "$1,875.00 min due",
    text: `Jane Doe just replied asking if she can pay 50% of invoice INV2-SFTE-Q4U3-NQ4Q-C5CW right now and the rest next week.`,
  },
  {
    id: "missing-data",
    label: "+ Missing Data Test",
    client: "Globex Corp",
    currency: "Unspecified",
    rate: "Ambiguous retainer",
    totalEst: "Validation Gate",
    text: `Invoice Globex for last month's SEO retainer and the two blog posts.`,
  },
];

export function ChatWorkspace() {
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "ledger">("chat");
  const [invoices, setInvoices] = useState<LedgerInvoice[]>([]);
  const [selectedSample, setSelectedSample] = useState(SAMPLES[0]);

  const { messages, sendMessage, status, error, stop } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  // Stable ledger fetcher
  const fetchLedger = useCallback(() => {
    fetch("/api/ledger", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices || []))
      .catch((err) => console.error("Ledger fetch failed:", err));
  }, []);

  const finishedDrafts = messages
    .flatMap((m) => m.parts)
    .filter((p) => p.type === "tool-create_invoice" && "state" in p && p.state === "output-available").length;

  useEffect(() => {
    fetchLedger();
  }, [finishedDrafts, fetchLedger]);

  const submit = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value || busy) return;
      sendMessage({ text: value });
      setInput("");
    },
    [busy, sendMessage],
  );

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[1400px] flex-col gap-4 p-4 md:p-6">
      {/* 1. Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-black text-lg font-black shadow-[0_0_25px_rgba(255,255,255,0.4)]">
            C
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="gradient-text text-glow font-black">CHASER</span>
            </h1>
            <p className="text-xs text-muted font-mono tracking-tight">AI drafts. Humans approve. PayPal settles.</p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/60 p-1 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === "chat" ? "bg-white text-black shadow-md" : "text-muted hover:text-white"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>AI Chat Agent</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ledger")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === "ledger" ? "bg-white text-black shadow-md" : "text-muted hover:text-white"
            }`}
          >
            <TableProperties className="h-3.5 w-3.5" />
            <span>AG Grid Approval Ledger</span>
            {invoices.filter((i) => i.status === "DRAFT").length > 0 && (
              <span className="rounded-full bg-amber-400 px-1.5 py-0.2 text-[10px] font-bold text-black">
                {invoices.filter((i) => i.status === "DRAFT").length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <SecurityArchitectureModal />
          <span className="glass flex items-center gap-2 rounded-full px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-warning" />
            PayPal Sandbox
          </span>
          <span className="glass hidden items-center gap-2 rounded-full px-3 py-1.5 sm:flex">
            <span className="h-2 w-2 rounded-full bg-success" />
            Zero-Trust Scope: <code className="font-mono text-ink">create_invoice</code> only
          </span>
        </div>
      </header>

      {/* 2. Main Workspace */}
      {activeTab === "ledger" ? (
        <section className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-ink">
                Human-In-The-Loop Approval Ledger
              </h2>
              <p className="text-xs text-muted">
                Powered by AG Grid &amp; Supabase. Review AI-drafted invoices and click &quot;Approve &amp; Send&quot; to officially dispatch via PayPal Invoicing API.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchLedger}
              className="glass flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-ink transition hover:border-accent/50"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <AGGridLedger invoices={invoices} onRefresh={fetchLedger} />
          </div>
        </section>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
          {/* Left Pane: Split SOW Workbench / Chat */}
          <section className="glass flex min-h-0 flex-col overflow-hidden rounded-2xl">
            {/* Quick-load Template Pills Bar */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-bg-elev/40 p-2.5">
              <span className="px-2 text-[11px] font-semibold text-muted uppercase tracking-wider">
                Templates:
              </span>
              {SAMPLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedSample(s);
                    setInput(s.text);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    selectedSample.id === s.id
                      ? "border border-accent/40 bg-accent/15 text-white"
                      : "border border-line bg-bg-elev/70 text-muted hover:text-ink"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Conversation Messages or Split SOW Workbench */}
            <div ref={scrollRef} className="scroll-slim flex-1 space-y-5 overflow-y-auto p-5 md:p-6">
              {messages.length === 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-ink">Scope of Work (SOW) Workbench</h3>
                      <p className="text-xs text-muted">
                        Paste contract terms, scope excerpts, or client emails. Gemini 2.5 Flash extracts deliverables and stages a PayPal draft.
                      </p>
                    </div>
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
                      Zero-Trust Guarded
                    </span>
                  </div>

                  {/* Split Workbench View */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Left: Raw Source Contract */}
                    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                      <div className="mb-2 flex items-center justify-between text-xs text-muted">
                        <span className="flex items-center gap-1.5 font-semibold text-ink">
                          <FileText className="h-3.5 w-3.5 text-accent" />
                          <span>Raw Contract / Client Email</span>
                        </span>
                        <span className="font-mono text-[10px]">Unstructured</span>
                      </div>
                      <pre className="scroll-slim max-h-52 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-ink/85 leading-relaxed">
                        {selectedSample.text}
                      </pre>
                    </div>

                    {/* Right: Extracted Schema Preview */}
                    <div className="rounded-xl border border-accent/20 bg-accent/[0.04] p-4">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-semibold text-accent">
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Agent Extraction Preview</span>
                        </span>
                        <span className="font-mono text-[10px] text-muted">Schema Verified</span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between border-b border-white/5 pb-1">
                          <span className="text-muted">Client Target:</span>
                          <span className="font-medium text-ink">{selectedSample.client}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-white/5 pb-1">
                          <span className="text-muted">Currency:</span>
                          <span className="font-mono text-ink">{selectedSample.currency}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-white/5 pb-1">
                          <span className="text-muted">Rate Card:</span>
                          <span className="text-ink">{selectedSample.rate}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-white/5 pb-1">
                          <span className="text-muted">Estimated Total:</span>
                          <span className="font-bold text-accent">{selectedSample.totalEst}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => submit(selectedSample.text)}
                        className="btn-primary mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-white shadow-lg"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Stage Draft Invoice with Gemini</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`animate-fade-up flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent/15 px-4 py-3 text-sm ring-1 ring-accent/25"
                        : "w-full max-w-[92%] space-y-3"
                    }
                  >
                    {m.parts && m.parts.length > 0 ? (
                      m.parts.map((part, i) => {
                        const key = `${m.id}-${i}`;
                        if (part.type === "text") {
                          return m.role === "user" ? (
                            <span key={key}>{part.text}</span>
                          ) : (
                            <div key={key} className="prose-chaser text-ink/90">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
                            </div>
                          );
                        }
                        const p = part as Record<string, unknown>;
                        if (
                          part.type === "tool-create_invoice" ||
                          (part.type === "dynamic-tool" && p.toolName === "create_invoice")
                        ) {
                          return <DraftInvoiceCard key={key} part={part as unknown as DraftToolPart} />;
                        }
                        return null;
                      })
                    ) : (
                      <span className="text-sm">{(m as unknown as Record<string, string>).content || (m as unknown as Record<string, string>).text || ""}</span>
                    )}
                  </div>
                </div>
              ))}

              {(status === "submitted" || status === "streaming") && (
                <div className="flex items-center gap-2 pl-1 text-xs text-muted">
                  <span className="typing-dot h-2 w-2 rounded-full bg-accent" />
                  <span className="typing-dot h-2 w-2 rounded-full bg-accent" />
                  <span className="typing-dot h-2 w-2 rounded-full bg-accent" />
                  <span className="text-ink/70">Analyzing contract &amp; staging PayPal Sandbox draft…</span>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {error.message || "Something went wrong."}
                </div>
              )}
            </div>

            {/* Composer */}
            <form
              className="border-t border-line p-3 md:p-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit(input);
              }}
            >
              <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-bg-elev/70 p-2 focus-within:border-accent/50">
                <textarea
                  id="chat-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit(input);
                    }
                  }}
                  rows={Math.min(6, Math.max(1, input.split("\n").length))}
                  placeholder="Paste contract terms, scope excerpts, or client emails to draft a PayPal invoice…"
                  className="max-h-48 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted"
                />
                {busy ? (
                  <button
                    id="chat-stop"
                    type="button"
                    onClick={() => stop()}
                    className="flex items-center gap-1.5 rounded-lg border border-line-strong px-4 py-2 text-sm text-muted hover:text-ink"
                  >
                    <StopCircle className="h-4 w-4" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    id="chat-send"
                    type="submit"
                    disabled={!input.trim()}
                    className="btn-primary flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Draft invoice</span>
                  </button>
                )}
              </div>
              <p className="mt-2 px-1 text-[11px] text-muted">
                The agent can only create <b>drafts</b>. Sending requires human approval in the AG Grid ledger. Enter to send · Shift+Enter for newline
              </p>
            </form>
          </section>

          {/* Right Pane: Structured Realtime Ledger Sidebar */}
          <LedgerPanel version={finishedDrafts} />
        </div>
      )}
    </div>
  );
}
