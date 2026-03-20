import { NextRequest, NextResponse } from "next/server";
import type { DBDriver } from "@/types";
import { execQueries } from "@/lib/dbPool";
import { buildMainQueries, buildSnsQuery, runVerification } from "@/lib/distribution-verify";

interface VerifyPayload {
  postId: string;
  driver: DBDriver;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  simulatedNow?: string;
}

export async function POST(request: NextRequest) {
  let payload: VerifyPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 });
  }

  const { postId, driver, host, port, database, username, password, simulatedNow } = payload;

  if (!postId?.toString().trim()) {
    return NextResponse.json({ success: false, message: "postId is required" }, { status: 400 });
  }
  if (!/^\d+$/.test(postId.toString().trim())) {
    return NextResponse.json({ success: false, message: "postId must be a numeric ID" }, { status: 400 });
  }
  if (driver === "mongodb" || driver === "sqlite") {
    return NextResponse.json({ success: false, message: `Driver '${driver}' not supported` }, { status: 400 });
  }

  const dbCfg = { driver, host, port, database, username, password };

  try {
    // Run primary queries (post info + assignments)
    const [postRows, assignmentRows] = await execQueries(dbCfg, buildMainQueries(postId)) as unknown[][];

    // SNS platforms are optional — table name may differ per environment
    let detailRows: unknown[] = [];
    try {
      const [sns] = await execQueries(dbCfg, [buildSnsQuery(postId)]) as unknown[][];
      detailRows = sns ?? [];
    } catch {
      // influencer_post_detail table not found — continue without SNS platform info
    }

    const result = runVerification(postRows, detailRows, assignmentRows, simulatedNow);
    return NextResponse.json({ success: true, result });
  } catch (err) {
    return NextResponse.json({
      success: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
