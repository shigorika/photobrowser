import { NextRequest } from "next/server";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { getPhotoById } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".bmp": "image/bmp",
  ".tiff": "image/tiff",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".3gp": "video/3gpp",
};

// Serve the original media by DB id (avoids exposing arbitrary filesystem paths).
// Supports HTTP Range so video seeking works.
export async function GET(req: NextRequest) {
  const id = parseInt(req.nextUrl.searchParams.get("id") || "", 10);
  if (!id) return new Response("Bad id", { status: 400 });

  const photo = getPhotoById(id);
  if (!photo) return new Response("Not found", { status: 404 });

  const filePath = photo.file_path;
  let size: number;
  try {
    size = (await fs.stat(filePath)).size;
  } catch {
    return new Response("File missing on disk", { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const range = req.headers.get("range");

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? parseInt(m[2], 10) : size - 1;
      if (start >= size || end >= size || start > end) {
        return new Response("Range not satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }
      const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
      return new Response(stream, {
        status: 206,
        headers: {
          "Content-Type": type,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
        },
      });
    }
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
