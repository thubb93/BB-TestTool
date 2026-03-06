import { NextRequest, NextResponse } from "next/server";
import type { DBDriver } from "@/types";
import { execQueries } from "@/lib/dbPool";

interface QueryPayload {
  driver: DBDriver;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  queries: string[];
}

export async function POST(request: NextRequest) {
  let payload: QueryPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 });
  }

  const { driver, host, port, database, username, password, queries } = payload;

  if (!queries?.length) {
    return NextResponse.json({ success: false, message: "No queries provided" }, { status: 400 });
  }

  if (driver === "mongodb") {
    return NextResponse.json({ success: false, message: "SQL queries not supported for MongoDB" }, { status: 400 });
  }

  if (driver === "sqlite") {
    return NextResponse.json({ success: false, message: "SQLite not supported server-side" }, { status: 400 });
  }

  try {
    const results = await execQueries({ driver, host, port, database, username, password }, queries);
    return NextResponse.json({ success: true, results });
  } catch (err) {
    return NextResponse.json({
      success: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
