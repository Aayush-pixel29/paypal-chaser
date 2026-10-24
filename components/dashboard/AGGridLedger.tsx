"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams, RowClickedEvent } from "ag-grid-community";
import { ModuleRegistry, AllCommunityModule, ValidationModule, themeQuartz } from "ag-grid-community";
import { getBrowserSupabase } from "@/lib/client/supabase";

// Register all community modules and developer validation for AG Grid
ModuleRegistry.registerModules([AllCommunityModule, ValidationModule]);

// AG Grid v33+ Theming API (Dark Mode tailored to Chaser palette)
const chaserDarkTheme = themeQuartz.withParams({
  backgroundColor: "#0b0d14",
  foregroundColor: "#e8eaf2",
  headerBackgroundColor: "#141724",
  headerTextColor: "#8b90a5",
  borderColor: "rgba(255, 255, 255, 0.08)",
  rowBorder: { style: "solid", width: 1, color: "rgba(255, 255, 255, 0.05)" },
  oddRowBackgroundColor: "rgba(255, 255, 255, 0.015)",
  accentColor: "#6366f1",
  fontFamily: "inherit",
  fontSize: 13,
});

export interface LedgerInvoice {
  id: string;
  paypal_invoice_id: string | null;
  total_amount: number | null;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED" | string;
  line_items?: Array<{
    name?: string;
    description?: string;
    quantity?: string | number;
    unit_amount?: { value?: string | number; currency_code?: string };
    unit_of_measure?: string;
  }> | unknown;
  clients: { name: string | null; email: string | null } | null;
}

interface AGGridLedgerProps {
  invoices: LedgerInvoice[];
  onRefresh: () => void;
}

export function AGGridLedger({ invoices, onRefresh }: AGGridLedgerProps) {
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Master/Detail Drawer State
  const [selectedInvoice, setSelectedInvoice] = useState<LedgerInvoice | null>(null);

  // AI Tone-Escalating Reminder Modal State
  const [reminderModalInvoice, setReminderModalInvoice] = useState<LedgerInvoice | null>(null);
  const [reminderSubject, setReminderSubject] = useState("");
  const [reminderNote, setReminderNote] = useState("");
  const [isSendingReminder, setIsSendingReminder] = useState(false);

  // 1. Supabase Realtime Listener (Ground Truth Sync)
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel("realtime_invoices_ledger")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices" },
        (payload) => {
          console.log("[realtime] Invoices table changed in Supabase:", payload);
          onRefresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onRefresh]);

  // 2. Action: Approve & Send
  const handleApproveAndSend = useCallback(
    async (paypalInvoiceId: string) => {
      if (!paypalInvoiceId) return;
      setActionInProgressId(paypalInvoiceId);
      setSendError(null);
      setSuccessMessage(null);

      try {
        const res = await fetch(`/api/invoices/${encodeURIComponent(paypalInvoiceId)}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            note: "Approved by human operator and officially dispatched via PayPal API.",
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to send invoice");
        }

        setSuccessMessage(`Invoice ${paypalInvoiceId} approved and dispatched via PayPal API!`);
        onRefresh();
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (err) {
        setSendError((err as Error).message);
      } finally {
        setActionInProgressId(null);
      }
    },
    [onRefresh],
  );

  // 3. Action: Simulate Overdue (Demo Acceleration)
  const handleSimulateOverdue = useCallback(
    async (paypalInvoiceId: string) => {
      if (!paypalInvoiceId) return;
      setActionInProgressId(paypalInvoiceId);
      setSendError(null);

      try {
        const res = await fetch(`/api/invoices/${encodeURIComponent(paypalInvoiceId)}/overdue`, {
          method: "POST",
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to simulate overdue status");
        }

        setSuccessMessage(`Invoice ${paypalInvoiceId} marked as 7 Days OVERDUE! Chaser escalation ready.`);
        onRefresh();
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (err) {
        setSendError((err as Error).message);
      } finally {
        setActionInProgressId(null);
      }
    },
    [onRefresh],
  );

  // 4. Action: Open AI Reminder Drawer
  const handleOpenReminderModal = useCallback((inv: LedgerInvoice) => {
    setReminderModalInvoice(inv);
    const clientName = inv.clients?.name || "Client";
    setReminderSubject(`Urgent: Invoice ${inv.paypal_invoice_id} is 7 days past due`);
    setReminderNote(
      `Hi ${clientName},\n\nWe noticed payment for your invoice (${inv.paypal_invoice_id}) totaling $${inv.total_amount?.toFixed(
        2,
      )} is now 7 days past due. To prevent service disruption, please remit payment via the secure PayPal link below.\n\nThank you for your prompt attention.`,
    );
  }, []);

  // 5. Action: Dispatch AI Reminder
  const handleDispatchReminder = useCallback(async () => {
    if (!reminderModalInvoice?.paypal_invoice_id) return;
    setIsSendingReminder(true);
    try {
      const res = await fetch(
        `/api/invoices/${encodeURIComponent(reminderModalInvoice.paypal_invoice_id)}/remind`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: reminderSubject,
            note: reminderNote,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch reminder");

      setSuccessMessage(
        `Tone-escalated reminder for ${reminderModalInvoice.paypal_invoice_id} dispatched via PayPal API!`,
      );
      setReminderModalInvoice(null);
      onRefresh();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setIsSendingReminder(false);
    }
  }, [reminderModalInvoice, reminderSubject, reminderNote, onRefresh]);

  // 6. Action: Copy Payment Link
  const handleCopyPaymentLink = useCallback((paypalInvoiceId: string) => {
    const link = `https://www.sandbox.paypal.com/invoice/p/#${paypalInvoiceId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(paypalInvoiceId);
    setTimeout(() => setCopiedId(null), 2500);
  }, []);

  // 7. Action: Reset Demo Ledger (Seed realistic data)
  const [isResetting, setIsResetting] = useState(false);
  const handleResetLedger = useCallback(async () => {
    setIsResetting(true);
    try {
      const res = await fetch("/api/ledger/seed", { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset demo ledger");
      onRefresh();
      setSuccessMessage("Demo ledger reset with 4 realistic clients across DRAFT, SENT, OVERDUE, and PAID states!");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setIsResetting(false);
    }
  }, [onRefresh]);

  // Aggregated KPIs
  const kpis = useMemo(() => {
    let totalDrafted = 0;
    let totalSent = 0;
    let totalOverdue = 0;
    let totalPaid = 0;

    for (const inv of invoices) {
      const amount = Number(inv.total_amount || 0);
      if (inv.status === "DRAFT") totalDrafted += amount;
      else if (inv.status === "SENT") totalSent += amount;
      else if (inv.status === "OVERDUE") totalOverdue += amount;
      else if (inv.status === "PAID") totalPaid += amount;
    }

    const totalVolume = totalDrafted + totalSent + totalOverdue + totalPaid;
    return {
      totalVolume,
      totalDrafted,
      totalSent,
      totalOverdue,
      totalPaid,
      count: invoices.length,
    };
  }, [invoices]);

  // Pinned Bottom Row Data for AG Grid
  const pinnedBottomRowData = useMemo(() => {
    if (invoices.length === 0) return [];
    return [
      {
        id: "pinned-summary",
        paypal_invoice_id: `${invoices.length} Invoices Active`,
        total_amount: kpis.totalVolume,
        status: `Paid: $${kpis.totalPaid.toFixed(0)} | Due: $${(kpis.totalSent + kpis.totalOverdue).toFixed(0)}`,
        clients: { name: "∑ Total Ledger Portfolio", email: "Autonomous Chaser Balance" },
      },
    ];
  }, [invoices.length, kpis]);

  // Column Definitions
  const columnDefs: ColDef<LedgerInvoice>[] = useMemo(
    () => [
      {
        headerName: "Client",
        field: "clients.name",
        flex: 1.6,
        minWidth: 180,
        cellRenderer: (params: ICellRendererParams<LedgerInvoice>) => {
          if (params.node.isRowPinned()) {
            return (
              <div className="flex flex-col justify-center font-bold text-accent py-1">
                <span>{params.data?.clients?.name}</span>
                <span className="text-[10px] text-muted">{params.data?.clients?.email}</span>
              </div>
            );
          }
          const client = params.data?.clients;
          return (
            <div className="flex flex-col justify-center leading-snug py-1">
              <span className="font-medium text-ink">{client?.name || "Client"}</span>
              <span className="text-[11px] text-muted truncate">{client?.email || "No email"}</span>
            </div>
          );
        },
      },
      {
        headerName: "PayPal ID",
        field: "paypal_invoice_id",
        flex: 1.5,
        minWidth: 170,
        cellRenderer: (params: ICellRendererParams<LedgerInvoice>) => {
          if (params.node.isRowPinned()) {
            return (
              <div className="flex items-center h-full font-mono text-xs text-muted">
                {params.value}
              </div>
            );
          }
          const invId = params.value;
          if (!invId) return <span className="text-muted">—</span>;
          return (
            <div className="flex items-center gap-2 h-full">
              <code className="rounded bg-white/5 px-2 py-0.5 font-mono text-xs text-accent ring-1 ring-white/10">
                {invId}
              </code>
              <a
                href={`https://www.sandbox.paypal.com/invoice/details/${invId}`}
                target="_blank"
                rel="noopener noreferrer"
                title="View in PayPal Sandbox Dashboard"
                className="text-[11px] text-muted hover:text-accent transition flex items-center gap-0.5 underline"
                onClick={(e) => e.stopPropagation()}
              >
                View ↗
              </a>
            </div>
          );
        },
      },
      {
        headerName: "Amount",
        field: "total_amount",
        flex: 1,
        minWidth: 120,
        valueFormatter: (params) =>
          params.value != null
            ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                Number(params.value),
              )
            : "$0.00",
        cellClass: (params) =>
          params.node.isRowPinned()
            ? "font-bold text-accent flex items-center text-sm"
            : "font-semibold text-ink flex items-center",
      },
      {
        headerName: "Status",
        field: "status",
        flex: 1.2,
        minWidth: 140,
        cellRenderer: (params: ICellRendererParams<LedgerInvoice>) => {
          if (params.node.isRowPinned()) {
            return (
              <div className="flex items-center h-full text-xs text-muted font-mono">
                {params.value}
              </div>
            );
          }
          const status = params.value || "DRAFT";
          const styles: Record<string, string> = {
            DRAFT: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
            SENT: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
            OVERDUE: "bg-rose-500/15 text-rose-300 ring-rose-500/30 animate-pulse",
            PAID: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
            CANCELLED: "bg-white/10 text-muted ring-white/10",
          };
          return (
            <div className="flex items-center gap-1.5 h-full">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                  styles[status] ?? styles.DRAFT
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    status === "PAID"
                      ? "bg-emerald-400"
                      : status === "OVERDUE"
                      ? "bg-rose-400"
                      : status === "SENT"
                      ? "bg-blue-400"
                      : "bg-amber-400"
                  }`}
                />
                {status}
              </span>
            </div>
          );
        },
      },
      {
        headerName: "Human-In-The-Loop Actions",
        flex: 2.2,
        minWidth: 260,
        cellRenderer: (params: ICellRendererParams<LedgerInvoice>) => {
          if (params.node.isRowPinned()) {
            return (
              <div className="flex items-center h-full text-xs text-muted italic">
                Zero-Trust Audit Trail Enabled
              </div>
            );
          }
          const inv = params.data;
          if (!inv) return null;
          const isActing = actionInProgressId === inv.paypal_invoice_id;
          const isCopied = copiedId === inv.paypal_invoice_id;

          if (inv.status === "DRAFT") {
            return (
              <div className="flex items-center gap-2 h-full">
                <button
                  type="button"
                  disabled={isActing}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (inv.paypal_invoice_id) handleApproveAndSend(inv.paypal_invoice_id);
                  }}
                  className="btn-primary rounded-lg px-3 py-1.5 text-xs font-medium text-white shadow-md transition disabled:opacity-50 flex items-center gap-1"
                >
                  <span>🚀</span>
                  {isActing ? "Dispatching…" : "Approve & Send"}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedInvoice(inv);
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-muted hover:text-ink hover:bg-white/10 transition"
                >
                  Audit Trail
                </button>
              </div>
            );
          }

          if (inv.status === "SENT") {
            return (
              <div className="flex items-center gap-2 h-full">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (inv.paypal_invoice_id) handleCopyPaymentLink(inv.paypal_invoice_id);
                  }}
                  className="rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/20 transition flex items-center gap-1"
                >
                  <span>📋</span>
                  {isCopied ? "Link Copied!" : "Copy Pay Link"}
                </button>

                <button
                  type="button"
                  disabled={isActing}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (inv.paypal_invoice_id) handleSimulateOverdue(inv.paypal_invoice_id);
                  }}
                  title="Accelerate judging demo: Simulate 7 days elapsed to test autonomous Chaser escalation"
                  className="rounded-lg border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning hover:bg-warning/20 transition flex items-center gap-1"
                >
                  <span>⚡</span>
                  Simulate Overdue
                </button>
              </div>
            );
          }

          if (inv.status === "OVERDUE") {
            return (
              <div className="flex items-center gap-2 h-full">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenReminderModal(inv);
                  }}
                  className="rounded-lg border border-rose-500/40 bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/30 transition flex items-center gap-1 shadow-sm"
                >
                  <span>🔔</span>
                  AI Escalate &amp; Remind
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (inv.paypal_invoice_id) handleCopyPaymentLink(inv.paypal_invoice_id);
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-muted hover:text-ink transition"
                >
                  {isCopied ? "Copied!" : "Pay Link"}
                </button>
              </div>
            );
          }

          if (inv.status === "PAID") {
            return (
              <div className="flex items-center gap-2 h-full text-xs text-emerald-400 font-medium">
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 ring-1 ring-emerald-500/20">
                  <span>✓</span> Settled via PayPal Webhook
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedInvoice(inv);
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-muted hover:text-ink hover:bg-white/10 transition"
                >
                  Audit
                </button>
              </div>
            );
          }

          return (
            <div className="flex items-center h-full text-xs text-muted">
              <span>{inv.status}</span>
            </div>
          );
        },
      },
    ],
    [
      actionInProgressId,
      copiedId,
      handleApproveAndSend,
      handleSimulateOverdue,
      handleOpenReminderModal,
      handleCopyPaymentLink,
    ],
  );

  return (
    <div className="flex flex-col h-full gap-4">
      {/* KPI Ribbon Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted text-xs">
            <span>Total Invoiced</span>
            <span>📊</span>
          </div>
          <div className="mt-1 text-lg font-bold text-ink">
            ${kpis.totalVolume.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-muted">{kpis.count} Active Invoices</div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-300/80 text-xs">
            <span>Awaiting Approval (DRAFT)</span>
            <span>⏳</span>
          </div>
          <div className="mt-1 text-lg font-bold text-amber-400">
            ${kpis.totalDrafted.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-muted">HITL Gateway Protected</div>
        </div>

        <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.03] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-300/80 text-xs">
            <span>Chaser Out for Payment</span>
            <span>⚡</span>
          </div>
          <div className="mt-1 text-lg font-bold text-rose-400">
            ${(kpis.totalSent + kpis.totalOverdue).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-muted">Overdue &amp; Dispatched</div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-300/80 text-xs">
            <span>Settled (PAID)</span>
            <span>💰</span>
          </div>
          <div className="mt-1 text-lg font-bold text-emerald-400">
            ${kpis.totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-muted">Verified by Webhook</div>
        </div>
      </div>

      {/* Control Actions & Notifications */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Supabase Realtime Live Sync Active</span>
          <span className="text-white/20">|</span>
          <span>Click any row to view Master/Detail Audit Trail</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isResetting}
            onClick={handleResetLedger}
            title="Reset demo data with 4 diverse realistic clients in each status"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted hover:text-ink hover:bg-white/10 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>🔄</span>
            {isResetting ? "Resetting…" : "Reset Demo Ledger"}
          </button>
        </div>
      </div>

      {/* Error & Success Toasts */}
      {sendError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-400 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{sendError}</span>
          </div>
          <button type="button" onClick={() => setSendError(null)} className="underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-400 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* AG Grid Component */}
      <div className="w-full flex-1 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
        <AgGridReact
          modules={[AllCommunityModule]}
          theme={chaserDarkTheme}
          rowData={invoices}
          pinnedBottomRowData={pinnedBottomRowData}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
          }}
          rowHeight={60}
          headerHeight={44}
          onRowClicked={(event: RowClickedEvent<LedgerInvoice>) => {
            if (!event.node.isRowPinned() && event.data) {
              setSelectedInvoice(event.data);
            }
          }}
        />
      </div>

      {/* Master/Detail Expandable Audit Trail Drawer */}
      {selectedInvoice && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedInvoice(null)}
        >
          <div
            className="w-full max-w-xl h-full bg-[#0d0f17] border-l border-white/10 p-6 flex flex-col justify-between overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="flex items-start justify-between pb-4 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-accent bg-accent/10 px-2.5 py-0.5 rounded border border-accent/20">
                      {selectedInvoice.paypal_invoice_id}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        selectedInvoice.status === "PAID"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : selectedInvoice.status === "OVERDUE"
                          ? "bg-rose-500/20 text-rose-300"
                          : selectedInvoice.status === "SENT"
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {selectedInvoice.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-ink mt-2">
                    {selectedInvoice.clients?.name}
                  </h3>
                  <p className="text-xs text-muted">{selectedInvoice.clients?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="rounded-lg p-1.5 text-muted hover:text-ink hover:bg-white/10 transition"
                >
                  ✕
                </button>
              </div>

              {/* Zero-Trust Immutable Audit Trail */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                  Zero-Trust Cryptographic Audit Trail
                </h4>
                <div className="space-y-3 relative pl-6 border-l border-white/10 text-xs">
                  <div className="relative">
                    <div className="absolute -left-[31px] top-0 h-4 w-4 rounded-full bg-accent/20 border border-accent flex items-center justify-center text-[9px] text-accent">
                      1
                    </div>
                    <div className="font-semibold text-ink">AI Agent Drafted</div>
                    <p className="text-muted text-[11px]">
                      Google Gemini 2.5 Flash parsed unstructured scope of work into structured draft.
                    </p>
                  </div>

                  <div className="relative">
                    <div className="absolute -left-[31px] top-0 h-4 w-4 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-[9px] text-emerald-400">
                      2
                    </div>
                    <div className="font-semibold text-ink">Scope Minimization Verified</div>
                    <p className="text-muted text-[11px]">
                      Strict constraint enforced: Agent had ONLY <code className="font-mono text-emerald-300">create_invoice</code> permission.
                    </p>
                  </div>

                  <div className="relative">
                    <div
                      className={`absolute -left-[31px] top-0 h-4 w-4 rounded-full flex items-center justify-center text-[9px] ${
                        selectedInvoice.status !== "DRAFT"
                          ? "bg-accent/20 border border-accent text-accent"
                          : "bg-white/5 border border-white/20 text-muted"
                      }`}
                    >
                      3
                    </div>
                    <div className="font-semibold text-ink">Human-In-The-Loop Approval</div>
                    <p className="text-muted text-[11px]">
                      {selectedInvoice.status === "DRAFT"
                        ? "Pending: Privileged send API call blocked until human approves."
                        : "Approved: Human operator verified deliverables and authorized dispatch via PayPal API."}
                    </p>
                  </div>

                  <div className="relative">
                    <div
                      className={`absolute -left-[31px] top-0 h-4 w-4 rounded-full flex items-center justify-center text-[9px] ${
                        selectedInvoice.status === "PAID"
                          ? "bg-emerald-500/20 border border-emerald-400 text-emerald-400"
                          : "bg-white/5 border border-white/20 text-muted"
                      }`}
                    >
                      4
                    </div>
                    <div className="font-semibold text-ink">Ground Truth Webhook Settlement</div>
                    <p className="text-muted text-[11px]">
                      {selectedInvoice.status === "PAID"
                        ? "Settled: Confirmed via PayPal INVOICING.INVOICE.PAID webhook with RSA-2048 signature verification."
                        : "Awaiting client settlement through PayPal Sandbox checkout."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                  Line Items &amp; Deliverables
                </h4>
                <div className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
                  <table className="w-full text-xs text-left">
                    <thead className="border-b border-white/10 bg-white/5 text-muted">
                      <tr>
                        <th className="p-3">Item / Description</th>
                        <th className="p-3 text-right">Qty</th>
                        <th className="p-3 text-right">Unit Price</th>
                        <th className="p-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {Array.isArray(selectedInvoice.line_items) ? (
                        selectedInvoice.line_items.map((it, idx) => {
                          const name = it.name || it.description || `Item #${idx + 1}`;
                          const qty = Number(it.quantity || 1);
                          const unitPrice =
                            typeof it.unit_amount === "object"
                              ? Number(it.unit_amount?.value || 0)
                              : Number(it.unit_amount || 0);
                          const lineTotal = qty * unitPrice;
                          return (
                            <tr key={idx} className="hover:bg-white/[0.02]">
                              <td className="p-3 font-medium text-ink">{name}</td>
                              <td className="p-3 text-right text-muted">{qty}</td>
                              <td className="p-3 text-right text-muted">${unitPrice.toFixed(2)}</td>
                              <td className="p-3 text-right font-semibold text-ink">
                                ${lineTotal.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-3 text-muted text-center italic">
                            Line items details recorded in PayPal Sandbox
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="border-t border-white/10 font-bold bg-white/5">
                      <tr>
                        <td colSpan={3} className="p-3 text-right text-ink">
                          Invoice Total:
                        </td>
                        <td className="p-3 text-right text-accent">
                          ${Number(selectedInvoice.total_amount || 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="pt-4 mt-6 border-t border-white/10 flex items-center justify-between">
              <a
                href={`https://www.sandbox.paypal.com/invoice/details/${selectedInvoice.paypal_invoice_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent underline flex items-center gap-1 hover:text-accent/80 transition"
              >
                Open in PayPal Merchant Dashboard ↗
              </a>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-ink hover:bg-white/10 transition"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Tone-Escalating Reminder Modal */}
      {reminderModalInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setReminderModalInvoice(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-rose-500/30 bg-[#0e1018] p-6 shadow-2xl flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-300 ring-1 ring-rose-500/30">
                  <span>⚡</span> Autonomous Chaser Escalation
                </span>
                <h3 className="text-lg font-bold text-ink mt-2">
                  Dispatch Tone-Escalated Reminder
                </h3>
                <p className="text-xs text-muted">
                  Client is 7 days past due. Review AI-drafted reminder before approving dispatch via PayPal Invoicing API.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReminderModalInvoice(null)}
                className="text-muted hover:text-ink text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted block mb-1">Subject</label>
                <input
                  type="text"
                  value={reminderSubject}
                  onChange={(e) => setReminderSubject(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink focus:border-rose-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted block mb-1">
                  Escalated Note (PayPal Client Notification)
                </label>
                <textarea
                  rows={6}
                  value={reminderNote}
                  onChange={(e) => setReminderNote(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink focus:border-rose-400 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setReminderModalInvoice(null)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-muted hover:text-ink transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSendingReminder}
                onClick={handleDispatchReminder}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-rose-500 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>🚀</span>
                {isSendingReminder ? "Dispatching via PayPal…" : "Approve & Send Reminder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
