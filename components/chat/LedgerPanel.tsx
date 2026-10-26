"use client";

import { useEffect, useState } from "react";
import { Bot, UserCheck, CheckCircle2, Zap, Clock, ShieldCheck } from "lucide-react";

interface LedgerInvoice {
  id: string;
  paypal_invoice_id: string | null;
  total_amount: number | null;
  currency?: string | null;
  status: string;
  clients: { name: string | null; email: string | null } | null;
}

interface AgentLog {
  id: string;
  invoice_id?: string | null;
  actor?: string | null;
  action_proposed: string;
  approved: boolean;
  timestamp: string;
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-warning/15 text-warning ring-warning/30",
  SENT: "bg-accent/15 text-accent ring-accent/30",
  PAID: "bg-success/15 text-success ring-success/30",
  OVERDUE: "bg-danger/15 text-danger ring-danger/30",
  CANCELLED: "bg-white/5 text-muted ring-white/10",
};

export function LedgerPanel({ version }: { version: number }) {
  const [invoices, setInvoices] = useState<LedgerInvoice[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ledger", { cache: "no-store" })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Failed to load ledger");
        return json as { invoices: LedgerInvoice[]; logs: AgentLog[] };
      })
      .then((data) => {
        if (cancelled) return;
        setInvoices(data.invoices);
        setLogs(data.logs);
        setError(null);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [version]);

  const drafts = invoices.filter((i) => i.status === "DRAFT");
  const pendingTotal = drafts.reduce((s, i) => s + Number(i.total_amount ?? 0), 0);

  function parseLogItem(raw: string) {
    if (raw.startsWith("PAYMENT_VERIFIED")) {
      return {
        label: "Payment Settled",
        badge: "Webhook Verified",
        badgeStyle: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
        icon: CheckCircle2,
        desc: raw.replace("PAYMENT_VERIFIED", "").trim(),
      };
    }
    if (raw.startsWith("STATUS_ESCALATED")) {
      return {
        label: "Autonomous Chaser",
        badge: "7d Escalation",
        badgeStyle: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
        icon: Zap,
        desc: raw.replace("STATUS_ESCALATED", "").trim(),
      };
    }
    if (raw.startsWith("HUMAN_APPROVED")) {
      return {
        label: "Operator Authorization",
        badge: "Dispatched",
        badgeStyle: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
        icon: UserCheck,
        desc: raw.replace("HUMAN_APPROVED", "").trim(),
      };
    }
    if (raw.startsWith("PARTIAL_PAYMENT_PROPOSED")) {
      return {
        label: "Split Proposal Staged",
        badge: "Review Required",
        badgeStyle: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
        icon: Clock,
        desc: raw.replace("PARTIAL_PAYMENT_PROPOSED", "").trim(),
      };
    }
    if (raw.startsWith("SEND_INVOICE")) {
      return {
        label: "Draft Invoice Staged",
        badge: "HITL Gate",
        badgeStyle: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
        icon: Bot,
        desc: raw.replace("SEND_INVOICE", "").trim(),
      };
    }
    return {
      label: "Audit Event",
      badge: "Logged",
      badgeStyle: "bg-white/10 text-muted ring-white/15",
      icon: ShieldCheck,
      desc: raw,
    };
  }

  return (
    <aside className="glass hidden min-h-0 flex-col overflow-hidden rounded-2xl lg:flex">
      <div className="border-b border-line p-4">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted">
          <span>Ledger · Supabase Live</span>
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Awaiting approval" value={String(drafts.length)} />
          <Stat
            label="Pending value"
            value={new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(pendingTotal)}
          />
        </div>
      </div>

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
        {/* Live Invoices Snapshot */}
        <div className="p-4">
          <h3 className="mb-2 text-xs font-medium text-muted">Invoices</h3>
          {loading && <div className="shimmer h-14 rounded-xl" />}
          {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
          {!loading && !error && invoices.length === 0 && (
            <p className="text-xs text-muted">No invoices yet. Draft one from the workbench.</p>
          )}
          <ul className="space-y-2">
            {invoices.map((inv) => (
              <li key={inv.id} className="animate-fade-up rounded-xl border border-line bg-bg-elev/60 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {inv.clients?.name || inv.clients?.email || "Client"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                      STATUS_STYLE[inv.status] ?? STATUS_STYLE.CANCELLED
                    }`}
                  >
                    {inv.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted">
                  <code className="font-mono text-[11px] text-accent/80">{inv.paypal_invoice_id ?? "—"}</code>
                  <span className="font-semibold text-ink">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: inv.currency || "USD",
                    }).format(Number(inv.total_amount ?? 0))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Structured Zero-Trust Activity Feed */}
        <div className="border-t border-line p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
              Zero-Trust Audit Stream
            </h3>
            <span className="text-[10px] text-muted">Realtime</span>
          </div>

          <div className="space-y-2.5">
            {logs.map((log) => {
              const parsed = parseLogItem(log.action_proposed);
              const Icon = parsed.icon;
              return (
                <div
                  key={log.id}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5 transition hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-medium text-xs text-ink">
                      <Icon className="h-3.5 w-3.5 text-accent" />
                      <span>{parsed.label}</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.2 text-[9px] font-semibold ring-1 ${parsed.badgeStyle}`}>
                      {parsed.badge}
                    </span>
                  </div>

                  <p className="mt-1 line-clamp-2 text-[11px] font-mono text-muted leading-tight">
                    {parsed.desc}
                  </p>

                  <div className="mt-1.5 flex items-center justify-between border-t border-white/5 pt-1 text-[10px] text-muted/70">
                    <span>{log.approved ? "Authorized" : "Awaiting Human Approval"}</span>
                    <span>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })}
            {!loading && logs.length === 0 && <p className="text-xs text-muted">No audit events recorded yet.</p>}
          </div>
        </div>
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg-elev/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}
