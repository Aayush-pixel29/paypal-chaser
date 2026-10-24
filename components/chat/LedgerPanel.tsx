"use client";

import { useEffect, useState } from "react";

interface LedgerInvoice {
  id: string;
  paypal_invoice_id: string | null;
  total_amount: number | null;
  status: string;
  clients: { name: string | null; email: string | null } | null;
}
interface AgentLog {
  id: string;
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

  return (
    <aside className="glass hidden min-h-0 flex-col overflow-hidden rounded-2xl lg:flex">
      <div className="border-b border-line p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted">Ledger · Supabase</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Awaiting approval" value={String(drafts.length)} />
          <Stat
            label="Pending value"
            value={new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(pendingTotal)}
          />
        </div>
      </div>

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="mb-2 text-xs font-medium text-muted">Invoices</h3>
          {loading && <div className="shimmer h-14 rounded-xl" />}
          {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
          {!loading && !error && invoices.length === 0 && (
            <p className="text-xs text-muted">No invoices yet. Draft one from the chat.</p>
          )}
          <ul className="space-y-2">
            {invoices.map((inv) => (
              <li key={inv.id} className="animate-fade-up rounded-xl border border-line bg-bg-elev/60 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{inv.clients?.name || inv.clients?.email || "Unknown"}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${STATUS_STYLE[inv.status] ?? STATUS_STYLE.CANCELLED}`}
                  >
                    {inv.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted">
                  <code className="font-mono">{inv.paypal_invoice_id ?? "—"}</code>
                  <span className="text-ink">
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                      Number(inv.total_amount ?? 0),
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-line p-4">
          <h3 className="mb-2 text-xs font-medium text-muted">Agent activity</h3>
          <ol className="relative space-y-3 border-l border-line pl-4">
            {logs.map((log) => (
              <li key={log.id} className="text-xs">
                <span
                  className={`absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full ${log.approved ? "bg-success" : "bg-warning"}`}
                />
                <div className="font-mono text-[11px] leading-snug text-ink/85">{log.action_proposed}</div>
                <div className="mt-0.5 text-muted">
                  {log.approved ? "Approved" : "Pending human approval"} ·{" "}
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </li>
            ))}
            {!loading && logs.length === 0 && <li className="text-xs text-muted">No agent actions yet.</li>}
          </ol>
        </div>
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg-elev/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}
