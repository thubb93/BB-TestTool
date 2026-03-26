"use client";

/** Formats a DB date value for display */
function fmtDate(val: unknown): string {
  if (!val) return "—";
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? String(val) : d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

interface OrderRow {
  id: number;
  email: string;
  product_name: string;
  start_date: unknown;
  end_date: unknown;
}

interface TxRow {
  id: number;
  order_subscription_id: number;
  start_date: unknown;
  end_date: unknown;
}

interface Props {
  orders: OrderRow[];
  transactions: TxRow[];
  cronValue: string | null;
  cronNext: string | null; // computed NOW+5m value shown after update
}

export default function OrderStatusTable({ orders, transactions, cronValue, cronNext }: Props) {
  return (
    <div className="space-y-4">
      {/* Cron status */}
      <div className="card p-4">
        <h3 className="text-[12px] font-semibold text-gray-600 mb-2">SCAN_NFT_CRON_SCHEDULE</h3>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[11px] text-gray-400">Current</p>
            <p className="text-[13px] font-mono text-gray-800">{cronValue ?? "—"}</p>
          </div>
          {cronNext && (
            <>
              <span className="text-gray-300">→</span>
              <div>
                <p className="text-[11px] text-gray-400">After update</p>
                <p className="text-[13px] font-mono text-violet-700">{cronNext}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* order_subscription table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="text-[12px] font-semibold text-gray-600">order_subscription ({orders.length})</h3>
        </div>
        {orders.length === 0 ? (
          <p className="text-[12px] text-gray-400 p-4">No rows found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-500 text-left">
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">start_date</th>
                  <th className="px-3 py-2 font-medium">end_date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(row => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-500">{row.id}</td>
                    <td className="px-3 py-2 text-gray-700">{row.email}</td>
                    <td className="px-3 py-2 text-gray-700 max-w-[180px] truncate" title={row.product_name}>{row.product_name}</td>
                    <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{fmtDate(row.start_date)}</td>
                    <td className="px-3 py-2 font-mono text-amber-700 whitespace-nowrap">{fmtDate(row.end_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* payment_transaction table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="text-[12px] font-semibold text-gray-600">payment_transaction ({transactions.length})</h3>
        </div>
        {transactions.length === 0 ? (
          <p className="text-[12px] text-gray-400 p-4">No rows found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-500 text-left">
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">order_subscription_id</th>
                  <th className="px-3 py-2 font-medium">start_date</th>
                  <th className="px-3 py-2 font-medium">end_date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(row => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-500">{row.id}</td>
                    <td className="px-3 py-2 font-mono text-gray-700">{row.order_subscription_id}</td>
                    <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{fmtDate(row.start_date)}</td>
                    <td className="px-3 py-2 font-mono text-amber-700 whitespace-nowrap">{fmtDate(row.end_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
