import { NextRequest, NextResponse } from "next/server";
import type { DBDriver } from "@/types";
import { execQueries } from "@/lib/dbPool";

/** Hardcoded test emails — same list as the UI */
const ALLOWED_EMAILS = new Set([
  "thu.nguyen.outs+1@bluebelt.asia",
  "thu.nguyen.outs+2@bluebelt.asia",
  "thu.nguyen.outs+3@bluebelt.asia",
  "thu.nguyen.outs+6@bluebelt.asia",
]);

interface FetchPayload {
  driver: DBDriver;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  emails: string[];
}

export async function POST(request: NextRequest) {
  let payload: FetchPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 });
  }

  const { driver, host, port, database, username, password, emails } = payload;

  // Validate emails against the known test set to prevent injection
  const safeEmails = (emails ?? []).filter(e => ALLOWED_EMAILS.has(e));
  if (!safeEmails.length) {
    return NextResponse.json({ success: false, message: "No valid emails provided" }, { status: 400 });
  }

  const inList = safeEmails.map(e => `'${e}'`).join(", ");

  const orderQuery = `
    SELECT id, email, product_name, start_date, end_date
    FROM order_subscription
    WHERE email IN (${inList})
      AND product_name LIKE '%PRIME%'
      AND start_date > DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')
    ORDER BY id DESC
    LIMIT 20
  `;

  const txQuery = `
    SELECT pt.id, pt.order_subscription_id, pt.start_date, pt.end_date
    FROM payment_transaction pt
    WHERE pt.order_subscription_id IN (
      SELECT id FROM order_subscription
      WHERE email IN (${inList})
        AND product_name LIKE '%PRIME%'
    )
    AND pt.start_date > DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')
    ORDER BY pt.id DESC
    LIMIT 20
  `;

  // Use SELECT * to avoid assuming the key column name (could be 'key', 'name', 'code', etc.)
  const cronQuery = `SELECT * FROM sys_data LIMIT 100`;

  try {
    const cfg = { driver, host, port, database, username, password };
    const [orders, transactions, cronRows] = await execQueries(cfg, [orderQuery, txQuery, cronQuery]) as unknown[][];

    // Auto-detect which column holds 'SCAN_NFT_CRON_SCHEDULE' and which holds the schedule value
    const rows = (cronRows ?? []) as Record<string, unknown>[];
    let cronValue: string | null = null;
    let cronKeyCol: string | null = null;
    let cronValCol: string | null = null;

    for (const row of rows) {
      const cols = Object.keys(row);
      for (const col of cols) {
        if (row[col] === "SCAN_NFT_CRON_SCHEDULE") {
          cronKeyCol = col;
          // The value column is typically the other non-key string column
          cronValCol = cols.find(c => c !== col && typeof row[c] === "string" && c !== "id") ?? null;
          if (cronValCol) cronValue = row[cronValCol] as string;
          break;
        }
      }
      if (cronKeyCol) break;
    }

    return NextResponse.json({
      success: true,
      orders: orders ?? [],
      transactions: transactions ?? [],
      cronValue,
      cronKeyCol,
      cronValCol,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
