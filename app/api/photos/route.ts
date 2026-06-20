import { NextRequest, NextResponse } from "next/server";
import { queryPhotos, PhotoFilters } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const filters: PhotoFilters = {
    album: sp.get("album") || undefined,
    location: sp.get("location") || undefined,
    year: sp.get("year") ? parseInt(sp.get("year")!, 10) : undefined,
    month: sp.get("month") ? parseInt(sp.get("month")!, 10) : undefined,
    type: (sp.get("type") as "image" | "video") || undefined,
    q: sp.get("q") || undefined,
    sort: sp.get("sort") === "asc" ? "asc" : undefined,
  };
  const limit = Math.min(parseInt(sp.get("limit") || "60", 10) || 60, 200);
  const page = Math.max(parseInt(sp.get("page") || "0", 10) || 0, 0);

  try {
    const { rows, total } = queryPhotos(filters, limit, page * limit);
    return NextResponse.json({
      photos: rows,
      total,
      page,
      limit,
      hasMore: (page + 1) * limit < total,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Query failed", photos: [], total: 0 },
      { status: 500 },
    );
  }
}
