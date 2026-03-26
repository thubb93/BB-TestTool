import { NextRequest, NextResponse } from "next/server";
import type { DBDriver } from "@/types";
import { execQueries } from "@/lib/dbPool";

const ALLOWED_EMAILS = new Set([
  "thu.nguyen.outs+1@bluebelt.asia",
  "thu.nguyen.outs+2@bluebelt.asia",
  "thu.nguyen.outs+3@bluebelt.asia",
  "thu.nguyen.outs+6@bluebelt.asia",
]);

interface UpdatePayload {
  action: "update_dates" | "update_cron";
  driver: DBDriver;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  emails?: string[];
  cronValue?: string;
  /** Column that identifies the row, e.g. 'key', 'name', 'code' — auto-detected from fetch */
  cronKeyCol?: string;
  /** Column that holds the schedule value, e.g. 'value', 'data' — auto-detected from fetch */
  cronValCol?: string;
}

export async function POST(request: NextRequest) {
  let payload: UpdatePayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 });
  }

  const { action, driver, host, port, database, username, password, emails, cronValue, cronKeyCol, cronValCol } = payload;
  const cfg = { driver, host, port, database, username, password };

  try {
    if (action === "update_dates") {
      const safeEmails = (emails ?? []).filter(e => ALLOWED_EMAILS.has(e));
      if (!safeEmails.length) {
        return NextResponse.json({ success: false, message: "No valid emails provided" }, { status: 400 });
      }
      const inList = safeEmails.map(e => `'${e}'`).join(", ");

      // Update order_subscription end_date to NOW()
      const updateOsQuery = `
        UPDATE order_subscription
        SET end_date = NOW()
        WHERE email IN (${inList})
          AND product_name LIKE '%PRIME%'
      `;

      // Update payment_transaction end_date — only rows with start_date in current month
      const updatePtQuery = `
        UPDATE payment_transaction pt
        INNER JOIN order_subscription os ON pt.order_subscription_id = os.id
        SET pt.end_date = NOW()
        WHERE os.email IN (${inList})
          AND os.product_name LIKE '%PRIME%'
          AND pt.start_date > DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')
      `;

      await execQueries(cfg, [updateOsQuery, updatePtQuery]);
      return NextResponse.json({ success: true, message: "end_date set to NOW() in both tables" });
    }

    if (action === "update_cron") {
      if (!cronValue || !/^\d{2}_\d{2}:\d{2}$/.test(cronValue)) {
        return NextResponse.json({ success: false, message: "Invalid cron value format (expected DD_HH:mm)" }, { status: 400 });
      }
      // Use auto-detected column names from fetch; fall back to common names
      const keyCol = cronKeyCol ?? "name";
      const valCol = cronValCol ?? "value";

      const updateCronQuery = `UPDATE sys_data SET \`${valCol}\` = '${cronValue}' WHERE \`${keyCol}\` = 'SCAN_NFT_CRON_SCHEDULE'`;
      await execQueries(cfg, [updateCronQuery]);
      return NextResponse.json({ success: true, message: `SCAN_NFT_CRON_SCHEDULE set to ${cronValue}` });
    }

    return NextResponse.json({ success: false, message: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({
      success: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
