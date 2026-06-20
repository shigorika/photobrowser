import { NextRequest } from "next/server";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import { Readable } from "node:stream";
import { getPhotoById } from "@/lib/queries";
import { thumbPath } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = parseInt(req.nextUrl.searchParams.get("id") || "", 10);
  if (!id) return new Response("Bad id", { status: 400 });

  const photo = getPhotoById(id);
  if (!photo) return new Response("Not found", { status: 404 });

  const p = thumbPath(id);
  try {
    const st = await fs.stat(p);
    const stream = Readable.toWeb(createReadStream(p)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(st.size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Thumbnail missing", { status: 404 });
  }
}
