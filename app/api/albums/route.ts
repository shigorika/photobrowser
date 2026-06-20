import { NextResponse } from "next/server";
import { listAlbums } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ albums: listAlbums() });
  } catch {
    return NextResponse.json({ albums: [] });
  }
}
