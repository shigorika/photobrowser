import { getDb } from "./db";

export type PhotoFilters = {
  album?: string;
  location?: string;
  year?: number;
  month?: number; // 1-12, requires year
  type?: "image" | "video";
  q?: string;
  sort?: "asc" | "desc"; // by date taken; default "desc" (newest first)
};

export type PhotoRow = {
  id: number;
  filename: string;
  media_type: "image" | "video";
  album: string | null;
  taken_at: number | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  title: string | null;
  description: string | null;
  device_type: string | null;
  width: number | null;
  height: number | null;
};

const GRID_COLUMNS = `p.id, p.filename, p.media_type, p.album, p.taken_at, p.latitude, p.longitude,
  p.location_name, p.title, p.description, p.device_type, p.width, p.height`;

// Build a safe FTS5 prefix query from free text.
function ftsQuery(q: string): string | null {
  const tokens = q
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!tokens.length) return null;
  return tokens.map((t) => `${t}*`).join(" ");
}

function buildWhere(f: PhotoFilters) {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (f.album) {
    clauses.push("p.album = @album");
    params.album = f.album;
  }
  if (f.location) {
    clauses.push("p.location_name = @location");
    params.location = f.location;
  }
  if (f.type) {
    clauses.push("p.media_type = @type");
    params.type = f.type;
  }
  // Year/month filter on taken_at (unix seconds), computed in UTC.
  if (f.year) {
    const start = Date.UTC(f.year, f.month ? f.month - 1 : 0, 1) / 1000;
    const end =
      (f.month
        ? Date.UTC(f.year, f.month, 1)
        : Date.UTC(f.year + 1, 0, 1)) / 1000;
    clauses.push("p.taken_at >= @tstart AND p.taken_at < @tend");
    params.tstart = start;
    params.tend = end;
  }
  return { clauses, params };
}

export function queryPhotos(f: PhotoFilters, limit: number, offset: number) {
  const db = getDb();
  const { clauses, params } = buildWhere(f);

  const fts = f.q ? ftsQuery(f.q) : null;
  let from = "FROM photos p";
  if (fts) {
    from += " JOIN photos_fts ON photos_fts.rowid = p.id";
    clauses.push("photos_fts MATCH @fts");
    (params as Record<string, unknown>).fts = fts;
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  // Sort by date taken (default newest first); NULL taken_at always sinks last.
  const dir = f.sort === "asc" ? "ASC" : "DESC";
  const order = `ORDER BY (p.taken_at IS NULL) ASC, p.taken_at ${dir}, p.id ${dir}`;

  const rows = db
    .prepare(`SELECT ${GRID_COLUMNS} ${from} ${where} ${order} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset }) as PhotoRow[];

  const total = (
    db.prepare(`SELECT COUNT(*) AS n ${from} ${where}`).get(params) as { n: number }
  ).n;

  return { rows, total };
}

export function getPhotoById(id: number) {
  const db = getDb();
  return db.prepare(`SELECT * FROM photos WHERE id = ?`).get(id) as
    | (PhotoRow & { file_path: string; thumbnail_path: string | null })
    | undefined;
}

export function listAlbums() {
  const db = getDb();
  return db
    .prepare(
      `SELECT album, COUNT(*) AS count,
         MIN(taken_at) AS first_taken, MAX(taken_at) AS last_taken
       FROM photos WHERE album IS NOT NULL
       GROUP BY album ORDER BY count DESC, album ASC`,
    )
    .all() as { album: string; count: number; first_taken: number | null; last_taken: number | null }[];
}

export function listLocations() {
  const db = getDb();
  return db
    .prepare(
      `SELECT location_name, COUNT(*) AS count
       FROM photos WHERE location_name IS NOT NULL
       GROUP BY location_name ORDER BY count DESC, location_name ASC`,
    )
    .all() as { location_name: string; count: number }[];
}

// Year -> month counts for the timeline navigator.
export function listTimeline() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         CAST(strftime('%Y', taken_at, 'unixepoch') AS INTEGER) AS year,
         CAST(strftime('%m', taken_at, 'unixepoch') AS INTEGER) AS month,
         COUNT(*) AS count
       FROM photos WHERE taken_at IS NOT NULL
       GROUP BY year, month ORDER BY year DESC, month DESC`,
    )
    .all() as { year: number; month: number; count: number }[];

  const byYear = new Map<number, { year: number; count: number; months: { month: number; count: number }[] }>();
  for (const r of rows) {
    if (!byYear.has(r.year)) byYear.set(r.year, { year: r.year, count: 0, months: [] });
    const y = byYear.get(r.year)!;
    y.count += r.count;
    y.months.push({ month: r.month, count: r.count });
  }
  return [...byYear.values()];
}

export function stats() {
  const db = getDb();
  return db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(media_type = 'image') AS images,
        SUM(media_type = 'video') AS videos,
        SUM(location_name IS NOT NULL) AS located
      FROM photos`,
    )
    .get() as { total: number; images: number; videos: number; located: number };
}
