import { NextResponse } from "next/server";
import type { DBDriver } from "@/types";

export async function GET() {
  const driver = process.env.DEFAULT_DB_DRIVER as DBDriver | undefined;

  if (!driver) {
    return NextResponse.json({ configured: false });
  }

  return NextResponse.json({
    configured: true,
    name: process.env.DEFAULT_DB_NAME || "Default DB",
    driver,
    host: process.env.DEFAULT_DB_HOST || "localhost",
    port: Number(process.env.DEFAULT_DB_PORT) || 3306,
    database: process.env.DEFAULT_DB_DATABASE || "",
    username: process.env.DEFAULT_DB_USERNAME || "",
    password: process.env.DEFAULT_DB_PASSWORD || "",
  });
}
