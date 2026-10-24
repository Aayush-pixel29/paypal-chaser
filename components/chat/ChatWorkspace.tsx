"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DraftInvoiceCard, type DraftToolPart } from "./DraftInvoiceCard";
import { LedgerPanel } from "./LedgerPanel";
import { AGGridLedger, type LedgerInvoice } from "../dashboard/AGGridLedger";
import { SecurityArchitectureModal } from "../dashboard/SecurityArchitectureModal";

const SAMPLES = [
  {
    label: "Web redesign SOW (US Client)",
    text: `Scope of work for Acme Global Robotics (billing contact: Jane Doe, sb-lfyee53530704@personal.example.com, 100 Montgomery St, San Francisco, CA 94104 US)
- Landing page redesign: 24 hours @ $85/hr
- Design system in Figma: flat fee $1,200
- 2 rounds of revisions: 6 hours @ $85/hr
Currency USD.`,
  },
  {
    label: "Can I pay half now? (Partial Split)",
    text: `Jane Doe just replied asking if she can pay 50% of invoice INV2-72AT-G5P8-GL4K-8FLQ right now and the rest next week.`,
  },
  {
    label: "Casual message (UK Client)",
    text: `bill Rohan Mehta (rohan.mehta.uk@example.com, London, UK) for the logo work — 3 concepts at 150 each plus 4 hours of edits at 60/hr in USD`,
  },
  {
    label: "Missing info test",
    text: `Invoice Globex for last month's SEO retainer and the two blog posts.`,
  },
];

export function ChatWorkspace() {
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "ledger">("chat");
  const [invoices, setInvoices] = useState<LedgerInvoice[]>([]);
  const [manualRefresh, setManualRefresh] = useState(0);

  const { messages, sendMessage, status, error, stop } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  // Refresh key for the ledger: bumps whenever a create_invoice tool finishes.
  const finishedDrafts = messages
    .flatMap((m) => m.parts)
    .filter((p) => p.type === "tool-create_invoice" && "state" in p && p.state === "output-available").length;

  const fetchLedger = useCallback(() => {
    fetch("/api/ledger", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices || []))
      .catch((err) => console.error("Ledger fetch failed:", err));
  }, []);

  useEffect(() => {
    fetchLedger();
  }, [finishedDrafts, manualRefresh, fetchLedger]);

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
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl btn-primary text-lg font-bold text-white shadow-lg">
            C
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              <span className="gradient-text">Chaser</span>
            </h1>
            <p className="text-xs text-muted">AI drafts. Humans approve. PayPal settles.</p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-line-strong bg-bg-elev/80 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "chat" ? "btn-primary text-white shadow" : "text-muted hover:text-ink"
            }`}
          >
            <span>💬</span> AI Chat Agent
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ledger")}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "ledger" ? "btn-primary text-white shadow" : "text-muted hover:text-ink"
            }`}
          >
            <span>📊</span> AG Grid Approval Ledger
            {invoices.filter((i) => i.status === "DRAFT").length > 0 && (
              <span className="rounded-full bg-warning px-1.5 py-0.2 text-[10px] font-bold text-black">
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

      {/* Main Content Area */}
      {activeTab === "ledger" ? (
        <section className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-ink">
                Human-In-The-Loop Approval Ledger
              </h2>
              <p className="text-xs text-muted">
                Powered by AG Grid & Supabase. Review AI-drafted invoices and click &quot;Approve &amp; Send&quot; to officially dispatch via PayPal.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setManualRefresh((v) => v + 1)}
              className="glass rounded-lg px-3 py-1.5 text-xs font-medium text-ink hover:border-accent/50"
            >
              ↻ Refresh
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <AGGridLedger
              invoices={invoices}
              onRefresh={() => {
                fetchLedger();
                setManualRefresh((v) => v + 1);
              }}
            />
          </div>
        </section>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
          {/* Chat */}
          <section className="glass flex min-h-0 flex-col overflow-hidden rounded-2xl">
            <div ref={scrollRef} className="scroll-slim flex-1 space-y-5 overflow-y-auto p-5 md:p-6">
              {messages.length === 0 && <EmptyState onPick={(t) => setInput(t)} />}

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
                    {m.parts.map((part, i) => {
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
                      if (part.type === "tool-create_invoice") {
                        return <DraftInvoiceCard key={key} part={part as unknown as DraftToolPart} />;
                      }
                      return null;
                    })}
                  </div>
                </div>
              ))}

              {status === "submitted" && (
                <div className="flex items-center gap-1.5 pl-1 text-muted">
                  <span className="typing-dot h-2 w-2 rounded-full bg-accent" />
                  <span className="typing-dot h-2 w-2 rounded-full bg-accent" />
                  <span className="typing-dot h-2 w-2 rounded-full bg-accent" />
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
                  placeholder="Paste a scope of work, contract excerpt, or just say who to bill…"
                  className="max-h-48 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted"
                />
                {busy ? (
                  <button
                    id="chat-stop"
                    type="button"
                    onClick={() => stop()}
                    className="rounded-lg border border-line-strong px-4 py-2 text-sm text-muted hover:text-ink"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    id="chat-send"
                    type="submit"
                    disabled={!input.trim()}
                    className="btn-primary rounded-lg px-4 py-2 text-sm font-medium text-white"
                  >
                    Draft invoice
                  </button>
                )}
              </div>
              <p className="mt-2 px-1 text-[11px] text-muted">
                The agent can only create <b>drafts</b>. Sending requires human approval in the AG Grid ledger. Enter to send · Shift+Enter for newline
              </p>
            </form>
          </section>

          {/* Ledger Sidebar */}
          <LedgerPanel version={finishedDrafts + manualRefresh} />
        </div>
      )}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-10 text-center">
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-accent/15 text-2xl ring-1 ring-accent/30">
        ✦
      </div>
      <h2 className="text-2xl font-semibold tracking-tight">
        Stop chasing invoices. <span className="gradient-text">Let Chaser draft them.</span>
      </h2>
      <p className="mt-2 text-sm text-muted">
        Paste any scope of work. The AI extracts line items, creates a real PayPal draft invoice, and records it in
        your ledger — then waits for you to approve in AG Grid.
      </p>
      <div className="mt-6 grid w-full gap-2 sm:grid-cols-3">
        {SAMPLES.map((s) => (
          <button
            key={s.label}
            id={`sample-${s.label.toLowerCase().replace(/\s+/g, "-")}`}
            onClick={() => onPick(s.text)}
            className="glass rounded-xl px-3 py-3 text-left text-xs transition hover:-translate-y-0.5 hover:border-accent/40"
          >
            <div className="font-medium text-ink">{s.label}</div>
            <div className="mt-1 line-clamp-2 text-muted">{s.text}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
