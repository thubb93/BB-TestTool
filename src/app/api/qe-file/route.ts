/**
 * GET /api/qe-file?name=filename.md
 * Returns the raw content of a markdown file from qe-reports/.
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const QE_DIR = path.join(process.cwd(), "qe-reports");

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "";

  // Prevent path traversal
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..") || name.includes("\0")) {
    return new NextResponse("Invalid filename", { status: 400 });
  }

  const filepath = path.join(QE_DIR, name);
  if (!filepath.startsWith(QE_DIR + path.sep)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const content = fs.readFileSync(filepath, "utf-8");
    return new NextResponse(content, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch {
    return new NextResponse("File not found", { status: 404 });
  }
}
