import { NextRequest, NextResponse } from "next/server";
import type { DBDriver } from "@/types";
import { execQueries } from "@/lib/dbPool";

interface ClearPayload {
  postId: string;
  driver: DBDriver;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export async function POST(request: NextRequest) {
  let payload: ClearPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 });
  }

  const { postId, driver, host, port, database, username, password } = payload;

  if (!postId?.toString().trim() || !/^\d+$/.test(postId.toString().trim())) {
    return NextResponse.json({ success: false, message: "postId must be a numeric ID" }, { status: 400 });
  }
  if (driver === "mongodb" || driver === "sqlite") {
    return NextResponse.json({ success: false, message: `Driver '${driver}' not supported` }, { status: 400 });
  }

  const id = Number(postId);
  const sql = `DELETE FROM user_influencer_post WHERE influencer_post_id = ${id}`;
  const dbCfg = { driver, host, port, database, username, password };

  try {
    const [result] = await execQueries(dbCfg, [sql]) as unknown[];
    // affectedRows varies by driver — best-effort extraction
    const affected = (result as Record<string, unknown>)?.affectedRows
      ?? (result as Record<string, unknown>)?.rowCount
      ?? "?";
    return NextResponse.json({ success: true, deleted: affected });
  } catch (err) {
    return NextResponse.json({
      success: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
