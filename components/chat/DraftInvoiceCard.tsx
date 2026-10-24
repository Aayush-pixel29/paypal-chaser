"use client";

export interface DraftToolPart {
  type: "tool-create_invoice";
  state: "input-streaming" | "input-available" | "output-available" | "output-error" | string;
  input?: {
    currency_code?: string;
    primary_recipients?: Array<{
      billing_info?: { email_address?: string; name?: { given_name?: string; surname?: string } };
    }>;
    items?: Array<{ name?: string; quantity?: string; unit_amount?: { value?: string } }>;
  };
  output?: {
    ok: boolean;
    error?: unknown;
    paypal_invoice_id?: string;
    invoice_number?: string;
    paypal_status?: string;
    total?: string;
    currency?: string;
    recipient?: { name: string | null; email: string | null };
  };
  errorText?: string;
}

const money = (v: number | string | undefined, c = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: c || "USD" }).format(Number(v ?? 0));

export function DraftInvoiceCard({ part }: { part: DraftToolPart }) {
  const items = part.input?.items ?? [];
  const currency = part.output?.currency ?? part.input?.currency_code ?? "USD";
  const recipient = part.input?.primary_recipients?.[0]?.billing_info;
  const recipientName =
    part.output?.recipient?.name ??
    [recipient?.name?.given_name, recipient?.name?.surname].filter(Boolean).join(" ");
  const recipientEmail = part.output?.recipient?.email ?? recipient?.email_address;

  const pending = part.state === "input-streaming" || part.state === "input-available";
  const failed = part.state === "output-error" || part.output?.ok === false;

  return (
    <div className="animate-fade-up overflow-hidden rounded-2xl border border-line-strong bg-bg-elev/80">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-accent/20 text-xs text-accent">$</span>
          PayPal draft invoice
        </div>
        {pending && <span className="text-xs text-muted">Creating in PayPal…</span>}
        {!pending && !failed && (
          <span className="rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-medium text-warning ring-1 ring-warning/30">
            DRAFT · awaiting approval
          </span>
        )}
        {failed && (
          <span className="rounded-full bg-danger/15 px-2.5 py-1 text-[11px] font-medium text-danger ring-1 ring-danger/30">
            Failed
          </span>
        )}
      </div>

      <div className="space-y-3 px-4 py-3 text-sm">
        <div className="flex flex-wrap justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted">Bill to</div>
            <div className="font-medium">{recipientName || "—"}</div>
            <div className="text-xs text-muted">{recipientEmail || "—"}</div>
          </div>
          {part.output?.paypal_invoice_id && (
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wide text-muted">PayPal ID</div>
              <code className="font-mono text-xs">{part.output.paypal_invoice_id}</code>
              {part.output.invoice_number && (
                <div className="text-xs text-muted">#{part.output.invoice_number}</div>
              )}
            </div>
          )}
        </div>

        {pending && items.length === 0 ? (
          <div className="space-y-2">
            <div className="shimmer h-4 rounded" />
            <div className="shimmer h-4 w-2/3 rounded" />
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-muted">
              <tr>
                <th className="py-1 text-left font-normal">Item</th>
                <th className="py-1 text-right font-normal">Qty</th>
                <th className="py-1 text-right font-normal">Unit</th>
                <th className="py-1 text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-1.5">{it.name}</td>
                  <td className="py-1.5 text-right">{it.quantity}</td>
                  <td className="py-1.5 text-right">{money(it.unit_amount?.value, currency)}</td>
                  <td className="py-1.5 text-right">
                    {money(Number(it.quantity ?? 0) * Number(it.unit_amount?.value ?? 0), currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {part.output?.ok && (
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-xs text-muted">Total (verified by PayPal)</span>
            <span className="text-lg font-semibold">{money(part.output.total, currency)}</span>
          </div>
        )}

        {failed && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
            {part.errorText ?? JSON.stringify(part.output?.error ?? "Unknown error")}
          </p>
        )}
      </div>
    </div>
  );
}
