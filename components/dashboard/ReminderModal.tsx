"use client";

import { useEffect, useState } from "react";
import { X, BellRing, Send } from "lucide-react";
import type { LedgerInvoice } from "./AGGridLedger";

interface ReminderModalProps {
  invoice: LedgerInvoice | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function ReminderModal({ invoice, onClose, onSuccess, onError }: ReminderModalProps) {
  const clientName = invoice?.clients?.name || "Client";
  const [subject, setSubject] = useState(
    () => (invoice ? `Urgent: Invoice ${invoice.paypal_invoice_id} is 7 days past due` : ""),
  );
  const [note, setNote] = useState(() =>
    invoice
      ? `Hi ${clientName},\n\nWe noticed payment for your invoice (${invoice.paypal_invoice_id}) totaling $${Number(
          invoice.total_amount || 0,
        ).toFixed(2)} is now 7 days past due. To prevent service disruption, please remit payment via the secure PayPal link below.\n\nThank you for your prompt attention.`
      : "",
  );
  const [isSending, setIsSending] = useState(false);

  // Escape key support
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!invoice) return null;

  async function handleDispatch() {
    if (!invoice?.paypal_invoice_id) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(invoice.paypal_invoice_id)}/remind`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-chaser-csrf": "chaser-direct-ui",
        },
        body: JSON.stringify({ subject, note }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch reminder");

      onSuccess(`Tone-escalated reminder for ${invoice.paypal_invoice_id} dispatched via PayPal API!`);
      onClose();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-rose-500/30 bg-[#0e1018] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-300 ring-1 ring-rose-500/30">
              <BellRing className="h-3.5 w-3.5" />
              Autonomous Chaser Escalation
            </span>
            <h3 className="mt-2 text-lg font-bold text-ink">Dispatch Tone-Escalated Reminder</h3>
            <p className="text-xs text-muted">
              Client is 7 days past due. Review AI-drafted reminder before approving dispatch via PayPal Invoicing API.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted transition hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink focus:border-rose-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">
              Escalated Note (PayPal Client Notification)
            </label>
            <textarea
              rows={6}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink focus:border-rose-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-muted transition hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSending}
            onClick={handleDispatch}
            className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-rose-500 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {isSending ? "Dispatching via PayPal…" : "Approve & Send Reminder"}
          </button>
        </div>
      </div>
    </div>
  );
}
