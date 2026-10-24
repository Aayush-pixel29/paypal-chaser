import { listAgentLogs, listInvoices } from "@/lib/server/ledger";

/** Read-only ledger snapshot for the UI (chat sidebar now, AG Grid in Phase 5). */
export async function GET() {
  try {
    const [invoices, logs] = await Promise.all([listInvoices(), listAgentLogs()]);
    return Response.json({ invoices, logs });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
