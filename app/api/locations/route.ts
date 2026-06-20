import { NextResponse } from "next/server";
import { listLocations } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ locations: listLocations() });
  } catch {
    return NextResponse.json({ locations: [] });
  }
}
