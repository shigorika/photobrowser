import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { runIndex, isBusy } from "@/lib/indexer";
import { writeConfig } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: start indexing the given absolute folder path.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { path?: string };
  const root = body.path?.trim();
  if (!root) {
    return NextResponse.json({ error: "Missing folder path" }, { status: 400 });
  }

  try {
    const st = await fs.stat(root);
    if (!st.isDirectory()) {
      return NextResponse.json({ error: "Path is not a directory" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Folder not found or not accessible" }, { status: 400 });
  }

  if (isBusy()) {
    return NextResponse.json({ error: "Indexing already in progress" }, { status: 409 });
  }

  writeConfig({ rootPath: root });
  // Kick off indexing in the background; don't await.
  void runIndex(root);

  return NextResponse.json({ ok: true });
}
