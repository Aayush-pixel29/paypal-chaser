"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams, RowClickedEvent } from "ag-grid-community";
import { ModuleRegistry, AllCommunityModule, themeQuartz } from "ag-grid-community";
import { getBrowserSupabase } from "@/lib/client/supabase";
import {
  Send,
  ShieldCheck,
  Copy,
  Check,
  Zap,
  BellRing,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  Split,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { KpiRibbon } from "./KpiRibbon";
import { AuditDrawer } from "./AuditDrawer";
import { ReminderModal } from "./ReminderModal";

// Register all community modules for AG Grid v36
ModuleRegistry.registerModules([AllCommunityModule]);

// AG Grid v36 Theming API (Dark Mode tailored to Chaser palette)
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
  currency?: string | null;
  payer_view_url?: string | null;
  proposed_min_amount?: number | null;
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

  // 1. Supabase Realtime Listener (Stable single subscription)
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
          headers: {
            "Content-Type": "application/json",
            "x-chaser-csrf": "chaser-direct-ui",
          },
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

  // 3. Action: Approve Proposed Split
  const handleApproveSplit = useCallback(
    async (inv: LedgerInvoice) => {
      if (!inv.paypal_invoice_id) return;
      setActionInProgressId(inv.paypal_invoice_id);
      setSendError(null);

      try {
        const res = await fetch(`/api/invoices/${encodeURIComponent(inv.paypal_invoice_id)}/partial`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-chaser-csrf": "chaser-direct-ui",
          },
          body: JSON.stringify({
            minimum_amount: inv.proposed_min_amount || 1875.0,
            currency: inv.currency || "USD",
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to approve split");

        setSuccessMessage(`Partial payment split approved for invoice ${inv.paypal_invoice_id}!`);
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

  // 4. Action: Simulate Overdue (Demo Acceleration)
  const handleSimulateOverdue = useCallback(
    async (paypalInvoiceId: string) => {
      if (!paypalInvoiceId) return;
      setActionInProgressId(paypalInvoiceId);
      setSendError(null);

      try {
        const res = await fetch(`/api/invoices/${encodeURIComponent(paypalInvoiceId)}/overdue`, {
          method: "POST",
          headers: { "x-chaser-csrf": "chaser-direct-ui" },
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to simulate overdue status");
        }

        setSuccessMessage(`Invoice ${paypalInvoiceId} marked as 7 Days OVERDUE! Autonomous Chaser activated.`);
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

  // 5. Action: Copy Payment Link
  const handleCopyPaymentLink = useCallback((inv: LedgerInvoice) => {
    const link =
      inv.payer_view_url ||
      `https://www.sandbox.paypal.com/invoice/p/#${inv.paypal_invoice_id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(inv.paypal_invoice_id || "");
    setTimeout(() => setCopiedId(null), 2500);
  }, []);

  // 6. Action: Reset Demo Ledger (Seed live PayPal sandbox data)
  const [isResetting, setIsResetting] = useState(false);
  const handleResetLedger = useCallback(async () => {
    setIsResetting(true);
    try {
      const res = await fetch("/api/ledger/seed", {
        method: "POST",
        headers: { "x-chaser-csrf": "chaser-direct-ui" },
      });
      if (!res.ok) throw new Error("Failed to reset demo ledger");
      onRefresh();
      setSuccessMessage("Demo ledger reset with 4 genuine PayPal Sandbox invoices across DRAFT, SENT, OVERDUE, and PAID!");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setIsResetting(false);
    }
  }, [onRefresh]);

  // Pinned Bottom Row Summary for AG Grid
  const pinnedBottomRowData = useMemo(() => {
    if (invoices.length === 0) return [];
    const totalVolume = invoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const paidVolume = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const dueVolume = invoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE").reduce((s, i) => s + Number(i.total_amount || 0), 0);

    return [
      {
        id: "pinned-summary",
        paypal_invoice_id: `${invoices.length} Invoices Active`,
        total_amount: totalVolume,
        status: `Paid: $${paidVolume.toFixed(0)} | Due: $${dueVolume.toFixed(0)}`,
        clients: { name: "∑ Total Portfolio Balance", email: "Autonomous Chaser Balance" },
      },
    ];
  }, [invoices]);

  // Column Definitions for AG Grid v36
  const columnDefs: ColDef<LedgerInvoice>[] = useMemo(
    () => [
      // Master/Detail Expand Chevron Column (Sponsor Criteria)
      {
        headerName: "",
        field: "id",
        width: 48,
        maxWidth: 48,
        resizable: false,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams<LedgerInvoice>) => {
          if (params.node.isRowPinned()) return null;
          return (
            <div className="flex h-full items-center justify-center text-muted transition group-hover:text-accent">
              <ChevronRight className="h-4 w-4" />
            </div>
          );
        },
      },
      // Client Column
      {
        headerName: "Client",
        field: "clients.name",
        flex: 1.5,
        minWidth: 170,
        cellRenderer: (params: ICellRendererParams<LedgerInvoice>) => {
          if (params.node.isRowPinned()) {
            return (
              <div className="flex flex-col justify-center py-1 font-bold text-accent">
                <span>{params.data?.clients?.name}</span>
                <span className="text-[10px] text-muted">{params.data?.clients?.email}</span>
              </div>
            );
          }
          const client = params.data?.clients;
          return (
            <div className="flex flex-col justify-center py-1 leading-snug">
              <span className="font-medium text-ink">{client?.name || "Client"}</span>
              <span className="truncate text-[11px] text-muted">{client?.email || "No email"}</span>
            </div>
          );
        },
      },
      // PayPal ID Column
      {
        headerName: "PayPal ID",
        field: "paypal_invoice_id",
        flex: 1.4,
        minWidth: 160,
        cellRenderer: (params: ICellRendererParams<LedgerInvoice>) => {
          if (params.node.isRowPinned()) {
            return (
              <div className="flex h-full items-center font-mono text-xs text-muted">
                {params.value}
              </div>
            );
          }
          const invId = params.value;
          if (!invId) return <span className="text-muted">—</span>;
          return (
            <div className="flex h-full items-center gap-2">
              <code className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-xs text-accent">
                {invId}
              </code>
              <a
                href={`https://www.sandbox.paypal.com/invoice/details/${invId}`}
                target="_blank"
                rel="noopener noreferrer"
                title="View in PayPal Merchant Dashboard"
                className="flex items-center gap-0.5 text-[11px] text-muted underline transition hover:text-accent"
                onClick={(e) => e.stopPropagation()}
              >
                <span>View</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          );
        },
      },
      // Amount Column
      {
        headerName: "Amount",
        field: "total_amount",
        flex: 1,
        minWidth: 110,
        valueFormatter: (params) => {
          const currency = params.data?.currency || "USD";
          return params.value != null
            ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(params.value))
            : "$0.00";
        },
        cellClass: (params) =>
          params.node.isRowPinned()
            ? "font-bold text-accent flex items-center text-sm"
            : "font-semibold text-ink flex items-center",
      },
      // Payment Progress & Aging Column
      {
        headerName: "Payment Progress",
        field: "status",
        flex: 1.3,
        minWidth: 150,
        cellRenderer: (params: ICellRendererParams<LedgerInvoice>) => {
          if (params.node.isRowPinned()) return null;
          const status = params.value || "DRAFT";
          const isPaid = status === "PAID";
          const isOverdue = status === "OVERDUE";
          const isSent = status === "SENT";

          return (
            <div className="flex h-full flex-col justify-center gap-1 py-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted">
                  {isPaid ? "100% Settled" : isOverdue ? "7 Days Overdue" : isSent ? "Awaiting Checkout" : "Draft Staged"}
                </span>
                <span className={isPaid ? "text-emerald-400 font-bold" : isOverdue ? "text-rose-400 font-bold" : "text-muted"}>
                  {isPaid ? "$ settled" : "$ due"}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isPaid
                      ? "w-full bg-emerald-400"
                      : isOverdue
                      ? "w-full bg-rose-500 animate-pulse"
                      : isSent
                      ? "w-1/3 bg-blue-400"
                      : "w-0"
                  }`}
                />
              </div>
            </div>
          );
        },
      },
      // Status Column
      {
        headerName: "Status",
        field: "status",
        flex: 1.1,
        minWidth: 120,
        cellRenderer: (params: ICellRendererParams<LedgerInvoice>) => {
          if (params.node.isRowPinned()) {
            return (
              <div className="flex h-full items-center font-mono text-xs text-muted">
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
            <div className="flex h-full items-center">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
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
      // HITL Action Controls Column
      {
        headerName: "Human-In-The-Loop Actions",
        flex: 2.2,
        minWidth: 260,
        cellRenderer: (params: ICellRendererParams<LedgerInvoice>) => {
          if (params.node.isRowPinned()) {
            return (
              <div className="flex h-full items-center text-xs text-muted italic">
                Zero-Trust Operator Guard Active
              </div>
            );
          }
          const inv = params.data;
          if (!inv) return null;
          const isActing = actionInProgressId === inv.paypal_invoice_id;
          const isCopied = copiedId === inv.paypal_invoice_id;

          // State: DRAFT
          if (inv.status === "DRAFT") {
            return (
              <div className="flex h-full items-center gap-2">
                <button
                  type="button"
                  disabled={isActing}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (inv.paypal_invoice_id) handleApproveAndSend(inv.paypal_invoice_id);
                  }}
                  className="btn-primary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white shadow-md transition disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isActing ? "Dispatching…" : "Approve & Send"}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedInvoice(inv);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-muted transition hover:bg-white/10 hover:text-ink"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Audit</span>
                </button>
              </div>
            );
          }

          // State: SENT
          if (inv.status === "SENT") {
            return (
              <div className="flex h-full items-center gap-2">
                {inv.proposed_min_amount ? (
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApproveSplit(inv);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/30"
                  >
                    <Split className="h-3.5 w-3.5" />
                    <span>Approve Split (${inv.proposed_min_amount})</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyPaymentLink(inv);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition hover:bg-accent/20"
                >
                  {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{isCopied ? "Link Copied!" : "Copy Pay Link"}</span>
                </button>

                <button
                  type="button"
                  disabled={isActing}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (inv.paypal_invoice_id) handleSimulateOverdue(inv.paypal_invoice_id);
                  }}
                  title="Accelerate judging demo: Simulate 7 days elapsed to test autonomous Chaser escalation"
                  className="flex items-center gap-1 rounded-lg border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning transition hover:bg-warning/20"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Simulate Overdue</span>
                </button>
              </div>
            );
          }

          // State: OVERDUE
          if (inv.status === "OVERDUE") {
            return (
              <div className="flex h-full items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setReminderModalInvoice(inv);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-300 shadow-sm transition hover:bg-rose-500/30"
                >
                  <BellRing className="h-3.5 w-3.5" />
                  <span>AI Escalate &amp; Remind</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyPaymentLink(inv);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-muted transition hover:text-ink"
                >
                  {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{isCopied ? "Copied!" : "Pay Link"}</span>
                </button>
              </div>
            );
          }

          // State: PAID
          if (inv.status === "PAID") {
            return (
              <div className="flex h-full items-center gap-2 text-xs font-medium text-emerald-400">
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 ring-1 ring-emerald-500/20">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Settled via Webhook</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedInvoice(inv);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-muted transition hover:bg-white/10 hover:text-ink"
                >
                  <ShieldCheck className="h-3 w-3" />
                  <span>Audit</span>
                </button>
              </div>
            );
          }

          return <div className="flex h-full items-center text-xs text-muted">{inv.status}</div>;
        },
      },
    ],
    [
      actionInProgressId,
      copiedId,
      handleApproveAndSend,
      handleApproveSplit,
      handleSimulateOverdue,
      handleCopyPaymentLink,
    ],
  );

  return (
    <div className="flex h-full flex-col gap-4">
      {/* 1. KPI Ribbon Header */}
      <KpiRibbon invoices={invoices} />

      {/* 2. Control Actions & Live Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Supabase Realtime Live Sync Active</span>
          <span className="text-white/20">|</span>
          <span>Click any row to open Master/Detail Audit Drawer</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isResetting}
            onClick={handleResetLedger}
            title="Reset demo data with 4 genuine PayPal Sandbox invoices"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted transition hover:bg-white/10 hover:text-ink disabled:opacity-50"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isResetting ? "animate-spin" : ""}`} />
            <span>{isResetting ? "Provisioning Sandbox Data…" : "Reset Demo Ledger"}</span>
          </button>
        </div>
      </div>

      {/* 3. Notifications */}
      {sendError && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-400 shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{sendError}</span>
          </div>
          <button type="button" onClick={() => setSendError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-400 shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* 4. AG Grid Table */}
      <div className="w-full flex-1 overflow-hidden rounded-xl border border-white/10 shadow-2xl">
        <AgGridReact
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

      {/* 5. Master/Detail Audit Drawer */}
      <AuditDrawer invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />

      {/* 6. AI Tone-Escalating Reminder Modal */}
      <ReminderModal
        invoice={reminderModalInvoice}
        onClose={() => setReminderModalInvoice(null)}
        onSuccess={(msg) => {
          setSuccessMessage(msg);
          onRefresh();
          setTimeout(() => setSuccessMessage(null), 5000);
        }}
        onError={(err) => setSendError(err)}
      />
    </div>
  );
}
