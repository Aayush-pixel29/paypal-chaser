"use client";

import { useMemo } from "react";
import { DollarSign, Clock, Zap, CheckCircle2 } from "lucide-react";
import type { LedgerInvoice } from "./AGGridLedger";

interface KpiRibbonProps {
  invoices: LedgerInvoice[];
}

export function KpiRibbon({ invoices }: KpiRibbonProps) {
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

  const money = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(val);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {/* Total Invoiced */}
      <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3.5 transition hover:border-white/20">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Total Invoiced</span>
          <DollarSign className="h-4 w-4 text-muted" />
        </div>
        <div className="mt-1 text-lg font-bold text-ink">{money(kpis.totalVolume)}</div>
        <div className="text-[11px] text-muted">{kpis.count} Total Invoices</div>
      </div>

      {/* Awaiting Approval */}
      <div className="flex flex-col justify-between rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-3.5 transition hover:border-amber-500/30">
        <div className="flex items-center justify-between text-xs text-amber-300/80">
          <span>Awaiting Approval (DRAFT)</span>
          <Clock className="h-4 w-4 text-amber-400" />
        </div>
        <div className="mt-1 text-lg font-bold text-amber-400">{money(kpis.totalDrafted)}</div>
        <div className="text-[11px] text-muted">HITL Gateway Protected</div>
      </div>

      {/* Chaser Out for Payment */}
      <div className="flex flex-col justify-between rounded-xl border border-rose-500/20 bg-rose-500/[0.03] p-3.5 transition hover:border-rose-500/30">
        <div className="flex items-center justify-between text-xs text-rose-300/80">
          <span>Chaser Out for Payment</span>
          <Zap className="h-4 w-4 text-rose-400" />
        </div>
        <div className="mt-1 text-lg font-bold text-rose-400">{money(kpis.totalSent + kpis.totalOverdue)}</div>
        <div className="text-[11px] text-muted">Overdue &amp; Dispatched</div>
      </div>

      {/* Settled */}
      <div className="flex flex-col justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-3.5 transition hover:border-emerald-500/30">
        <div className="flex items-center justify-between text-xs text-emerald-300/80">
          <span>Settled (PAID)</span>
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="mt-1 text-lg font-bold text-emerald-400">{money(kpis.totalPaid)}</div>
        <div className="text-[11px] text-muted">Verified by Webhook</div>
      </div>
    </div>
  );
}
