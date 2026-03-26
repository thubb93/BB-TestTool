/**
 * POST /api/qe-upload
 * Accepts multipart form-data with one or more .md files and saves them to qe-reports/.
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const QE_DIR = path.join(process.cwd(), "qe-reports");

export async function POST(req: NextRequest) {
  try {
    if (!fs.existsSync(QE_DIR)) fs.mkdirSync(QE_DIR, { recursive: true });

    const formData = await req.formData();
    const saved: string[] = [];

    for (const value of formData.values()) {
      if (!(value instanceof File)) continue;
      const { name } = value;

      // Only allow .md files with safe filenames
      if (!name.endsWith(".md") || name.includes("/") || name.includes("\\") || name.includes("..")) continue;

      const buffer = Buffer.from(await value.arrayBuffer());
      fs.writeFileSync(path.join(QE_DIR, name), buffer);
      saved.push(name);
    }

    if (saved.length === 0) {
      return NextResponse.json({ error: "No valid .md files found" }, { status: 400 });
    }

    return NextResponse.json({ saved });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
