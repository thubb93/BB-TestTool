/**
 * GET /api/qe-files
 * Lists .md files from the qe-reports/ directory, sorted by modified time desc.
 */
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const QE_DIR = path.join(process.cwd(), "qe-reports");

export async function GET() {
  try {
    if (!fs.existsSync(QE_DIR)) {
      return NextResponse.json([]);
    }
    const files = fs
      .readdirSync(QE_DIR)
      .filter((f) => f.endsWith(".md") && !f.startsWith("."))
      .map((f) => ({ f, stat: fs.statSync(path.join(QE_DIR, f)) }))
      .filter(({ stat }) => stat.isFile())
      .map(({ f, stat }) => ({ name: f, mtime: stat.mtime.toISOString(), size: stat.size }))
      .sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());

    return NextResponse.json(files);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
