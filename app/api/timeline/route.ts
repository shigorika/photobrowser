import { NextResponse } from "next/server";
import { listTimeline } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ timeline: listTimeline() });
  } catch {
    return NextResponse.json({ timeline: [] });
  }
}
