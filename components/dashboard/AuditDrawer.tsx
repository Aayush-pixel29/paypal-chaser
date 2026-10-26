"use client";

import { useEffect } from "react";
import { X, ExternalLink, ShieldCheck, Check, Clock, Bot, UserCheck } from "lucide-react";
import type { LedgerInvoice } from "./AGGridLedger";

interface AuditDrawerProps {
  invoice: LedgerInvoice | null;
  onClose: () => void;
}

export function AuditDrawer({ invoice, onClose }: AuditDrawerProps) {
  // Support Escape key to close
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!invoice) return null;

  const statusStyles: Record<string, string> = {
    DRAFT: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    SENT: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
    OVERDUE: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
    PAID: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    CANCELLED: "bg-white/10 text-muted ring-white/10",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex h-full w-full max-w-xl flex-col justify-between overflow-y-auto border-l border-white/10 bg-[#0d0f17] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded border border-accent/25 bg-accent/10 px-2.5 py-0.5 font-mono text-xs text-accent">
                  {invoice.paypal_invoice_id}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                    statusStyles[invoice.status] ?? statusStyles.DRAFT
                  }`}
                >
                  {invoice.status}
                </span>
              </div>
              <h3 className="mt-2 text-lg font-bold text-ink">{invoice.clients?.name || "Client"}</h3>
              <p className="text-xs text-muted">{invoice.clients?.email || "No email"}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted hover:bg-white/10 hover:text-ink transition"
              aria-label="Close drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Zero-Trust Cryptographic Audit Trail */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Zero-Trust Cryptographic Audit Trail
              </h4>
            </div>

            <div className="relative space-y-4 border-l border-white/10 pl-6 text-xs">
              {/* Step 1 */}
              <div className="relative">
                <div className="absolute -left-[31px] top-0 flex h-4 w-4 items-center justify-center rounded-full border border-accent bg-accent/20 text-[9px] text-accent">
                  <Bot className="h-2.5 w-2.5" />
                </div>
                <div className="font-semibold text-ink">AI Agent Drafted</div>
                <p className="text-[11px] text-muted">
                  Gemini 2.5 Flash parsed unstructured scope of work into structured PayPal draft.
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div className="absolute -left-[31px] top-0 flex h-4 w-4 items-center justify-center rounded-full border border-emerald-400 bg-emerald-500/20 text-[9px] text-emerald-400">
                  <ShieldCheck className="h-2.5 w-2.5" />
                </div>
                <div className="font-semibold text-ink">Zero-Trust Scope Verification</div>
                <p className="text-[11px] text-muted">
                  Strict constraint enforced: Agent had ONLY <code className="font-mono text-emerald-300">create_invoice</code> permission.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <div
                  className={`absolute -left-[31px] top-0 flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${
                    invoice.status !== "DRAFT"
                      ? "border border-accent bg-accent/20 text-accent"
                      : "border border-white/20 bg-white/5 text-muted"
                  }`}
                >
                  <UserCheck className="h-2.5 w-2.5" />
                </div>
                <div className="font-semibold text-ink">Human-In-The-Loop Approval Gate</div>
                <p className="text-[11px] text-muted">
                  {invoice.status === "DRAFT"
                    ? "Pending: Privileged dispatch blocked until operator verifies deliverables."
                    : "Authorized: Human operator approved invoice and dispatched via PayPal API."}
                </p>
              </div>

              {/* Step 4 */}
              <div className="relative">
                <div
                  className={`absolute -left-[31px] top-0 flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${
                    invoice.status === "PAID"
                      ? "border border-emerald-400 bg-emerald-500/20 text-emerald-400"
                      : "border border-white/20 bg-white/5 text-muted"
                  }`}
                >
                  {invoice.status === "PAID" ? <Check className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                </div>
                <div className="font-semibold text-ink">Ground-Truth Webhook Settlement</div>
                <p className="text-[11px] text-muted">
                  {invoice.status === "PAID"
                    ? "Settled: Confirmed via PayPal INVOICING.INVOICE.PAID webhook with verified signature."
                    : "Awaiting settlement confirmation from PayPal Sandbox checkout."}
                </p>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
              Deliverables &amp; Line Items
            </h4>
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 bg-white/5 text-muted">
                  <tr>
                    <th className="p-3">Item / Description</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {Array.isArray(invoice.line_items) ? (
                    invoice.line_items.map((it: Record<string, unknown>, idx: number) => {
                      const name = (it.name as string) || (it.description as string) || `Deliverable #${idx + 1}`;
                      const qty = Number(it.quantity || 1);
                      const unitAmountObj = it.unit_amount as { value?: string | number } | undefined;
                      const unitPrice =
                        typeof unitAmountObj === "object"
                          ? Number(unitAmountObj?.value || 0)
                          : Number(it.unit_amount || 0);
                      const lineTotal = qty * unitPrice;
                      return (
                        <tr key={idx} className="hover:bg-white/[0.02]">
                          <td className="p-3 font-medium text-ink">{name}</td>
                          <td className="p-3 text-right text-muted">{qty}</td>
                          <td className="p-3 text-right text-muted">${unitPrice.toFixed(2)}</td>
                          <td className="p-3 text-right font-semibold text-ink">${lineTotal.toFixed(2)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-3 text-center text-muted italic">
                        Line items recorded in PayPal Sandbox
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="border-t border-white/10 bg-white/5 font-bold">
                  <tr>
                    <td colSpan={3} className="p-3 text-right text-ink">
                      Total Due:
                    </td>
                    <td className="p-3 text-right text-accent">
                      ${Number(invoice.total_amount || 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
          <a
            href={`https://www.sandbox.paypal.com/invoice/details/${invoice.paypal_invoice_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-accent underline transition hover:text-accent/80"
          >
            <span>Open in PayPal Dashboard</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-ink transition hover:bg-white/10"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
}
