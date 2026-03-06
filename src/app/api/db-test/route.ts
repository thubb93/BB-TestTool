import { NextRequest, NextResponse } from "next/server";
import type { DBDriver } from "@/types";
import { pingPool } from "@/lib/dbPool";

interface TestPayload {
  driver: DBDriver;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export async function POST(request: NextRequest) {
  let payload: TestPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 });
  }

  const { driver, host, port, database, username, password } = payload;

  // MongoDB handled separately (no SQL pool)
  if (driver === "mongodb") {
    const start = Date.now();
    try {
      const { MongoClient } = await import("mongodb");
      const creds = username && password
        ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
        : "";
      const uri = `mongodb://${creds}${host}:${port}/${database}`;
      const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
      await client.connect();
      await client.db(database).command({ ping: 1 });
      await client.close();
      return NextResponse.json({ success: true, latency: Date.now() - start });
    } catch (err) {
      return NextResponse.json({
        success: false,
        message: err instanceof Error ? err.message : String(err),
        latency: Date.now() - start,
      });
    }
  }

  if (driver === "sqlite") {
    return NextResponse.json(
      { success: false, message: "SQLite connection test is not supported server-side." },
      { status: 400 }
    );
  }

  try {
    const { latency } = await pingPool({ driver, host, port, database, username, password });
    return NextResponse.json({ success: true, latency });
  } catch (err) {
    return NextResponse.json({
      success: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
