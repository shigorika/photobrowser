import { NextResponse } from "next/server";
import { getProgress } from "@/lib/indexer";
import { readConfig } from "@/lib/paths";
import { stats } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = readConfig();
  let s = { total: 0, photos: 0, screenshots: 0, videos: 0, located: 0 };
  try {
    s = stats();
  } catch {
    /* db may not exist yet */
  }
  return NextResponse.json({
    progress: getProgress(),
    rootPath: cfg.rootPath,
    stats: s,
  });
}
