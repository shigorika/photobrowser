import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getDb, resetIndex } from "./db";
import { THUMBS_DIR, thumbPath, ensureAppDir } from "./paths";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif", ".bmp", ".tiff"]);
const VIDEO_EXT = new Set([".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv", ".3gp"]);
const THUMB_SIZE = 400;

export type IndexProgress = {
  // 'indexing' = scanning files + thumbnails (blocks the browse UI)
  // 'geocoding' = background reverse-geocoding (UI is already usable)
  phase: "idle" | "indexing" | "geocoding" | "done";
  running: boolean; // indexing phase active
  geocoding: boolean; // background geocoding active
  done: boolean;
  error: string | null;
  total: number;
  processed: number;
  geoTotal: number; // distinct locations to resolve
  geoDone: number;
  currentFile: string;
  startedAt: number | null;
  finishedAt: number | null;
};

// Module-level singletons: the Node server keeps these across requests.
const progress: IndexProgress = {
  phase: "idle",
  running: false,
  geocoding: false,
  done: false,
  error: null,
  total: 0,
  processed: 0,
  geoTotal: 0,
  geoDone: 0,
  currentFile: "",
  startedAt: null,
  finishedAt: null,
};

// Guards the entire run (both phases) against a concurrent start.
let busy = false;

export function getProgress(): IndexProgress {
  return { ...progress };
}

export function isBusy(): boolean {
  return busy;
}

// Reproduce Google Takeout's sidecar filename: media name + the supplemental
// suffix, with the WHOLE filename truncated to 51 chars and ".json" preserved.
function expectedSidecar(mediaName: string): string {
  const full = `${mediaName}.supplemental-metadata.json`;
  if (full.length <= 51) return full;
  return full.slice(0, 51 - 5).replace(/\.+$/, "") + ".json";
}

// Robust fallback: strip a trailing ".supplemental-*.json" (any truncation) or
// a bare ".json" to recover the media base name a sidecar refers to.
function sidecarBase(jsonName: string): string {
  const m = jsonName.match(/^(.*?)\.suppl.*\.json$/i);
  if (m) return m[1];
  return jsonName.replace(/\.json$/i, "");
}

type Sidecar = {
  title?: string;
  description?: string;
  imageViews?: string;
  creationTime?: { timestamp?: string };
  photoTakenTime?: { timestamp?: string };
  geoData?: { latitude?: number; longitude?: number; altitude?: number };
  url?: string;
  googlePhotosOrigin?: { mobileUpload?: { deviceType?: string } };
};

async function readJson<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf8")) as T;
  } catch {
    return null;
  }
}

// ---- Reverse geocoding (Nominatim, rate-limited to 1 req/sec) ----
let lastGeocodeAt = 0;
const GEOCODE_MIN_INTERVAL = 1100;
const GEOCODE_TIMEOUT = 8000;

function coordKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`; // ~110m buckets, dedupes nearby shots
}

async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const db = getDb();
  const key = coordKey(lat, lon);
  const cached = db.prepare("SELECT name FROM geocode_cache WHERE key = ?").get(key) as
    | { name: string | null }
    | undefined;
  if (cached) return cached.name;

  const wait = GEOCODE_MIN_INTERVAL - (Date.now() - lastGeocodeAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGeocodeAt = Date.now();

  let name: string | null = null;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&accept-language=en`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), GEOCODE_TIMEOUT);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "photobrowser-local/1.0 (personal Takeout browser)" },
        signal: ctrl.signal,
      });
      if (res.ok) {
        const j = (await res.json()) as { address?: Record<string, string> };
        const a = j.address || {};
        const city = a.city || a.town || a.village || a.county || a.state_district || a.state;
        const country = a.country;
        name = [city, country].filter(Boolean).join(", ") || null;
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    name = null; // network error / timeout -> leave unresolved (still cached as null)
  }

  db.prepare("INSERT OR REPLACE INTO geocode_cache(key, name) VALUES (?, ?)").run(key, name);
  return name;
}

type MediaItem = { filePath: string; filename: string; dir: string; album: string | null };

async function collectMedia(root: string): Promise<MediaItem[]> {
  const items: MediaItem[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    // Album title: prefer metadata.json's title, else the folder name.
    const folderName = path.basename(dir);
    const meta = await readJson<{ title?: string }>(path.join(dir, "metadata.json"));
    const album = meta?.title?.trim() || folderName;

    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext)) {
          items.push({ filePath: full, filename: e.name, dir, album });
        }
      }
    }
  }

  await walk(root);
  return items;
}

async function makeThumb(
  item: MediaItem,
  id: number,
  isVideo: boolean,
): Promise<{ width: number | null; height: number | null }> {
  const out = thumbPath(id);
  if (isVideo) {
    // No ffmpeg available — render a dark placeholder tile with a play glyph.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_SIZE}" height="${Math.round(THUMB_SIZE * 0.66)}">
      <rect width="100%" height="100%" fill="#18181b"/>
      <circle cx="50%" cy="50%" r="34" fill="#ffffff" fill-opacity="0.9"/>
      <path d="M ${THUMB_SIZE / 2 - 10} ${THUMB_SIZE * 0.33 - 16} L ${THUMB_SIZE / 2 + 18} ${THUMB_SIZE * 0.33} L ${THUMB_SIZE / 2 - 10} ${THUMB_SIZE * 0.33 + 16} Z" fill="#18181b"/>
    </svg>`;
    await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toFile(out);
    return { width: null, height: null };
  }
  try {
    const img = sharp(item.filePath, { failOn: "none" });
    const meta = await img.metadata();
    await img
      .rotate()
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toFile(out);
    return { width: meta.width ?? null, height: meta.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

// Phase 2: reverse-geocode the deduplicated set of distinct coordinates and
// fill location_name across all matching rows. Runs after the index is browsable.
async function geocodeAll(): Promise<void> {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT id, latitude, longitude FROM photos WHERE latitude IS NOT NULL AND longitude IS NOT NULL",
    )
    .all() as { id: number; latitude: number; longitude: number }[];

  // Group photo ids by rounded coordinate so each location is geocoded once.
  const groups = new Map<string, { lat: number; lon: number; ids: number[] }>();
  for (const r of rows) {
    const key = coordKey(r.latitude, r.longitude);
    let g = groups.get(key);
    if (!g) {
      g = { lat: r.latitude, lon: r.longitude, ids: [] };
      groups.set(key, g);
    }
    g.ids.push(r.id);
  }

  progress.phase = "geocoding";
  progress.geocoding = true;
  progress.geoTotal = groups.size;
  progress.geoDone = 0;

  const update = db.prepare("UPDATE photos SET location_name = ? WHERE id = ?");
  const applyMany = db.transaction((ids: number[], name: string | null) => {
    for (const id of ids) update.run(name, id);
  });

  for (const g of groups.values()) {
    const name = await reverseGeocode(g.lat, g.lon);
    applyMany(g.ids, name);
    progress.geoDone++;
    progress.currentFile = name || `${g.lat.toFixed(3)}, ${g.lon.toFixed(3)}`;
  }

  progress.geocoding = false;
  progress.currentFile = "";
}

export async function runIndex(root: string): Promise<void> {
  if (busy) return;
  busy = true;
  ensureAppDir();
  Object.assign(progress, {
    phase: "indexing",
    running: true,
    geocoding: false,
    done: false,
    error: null,
    total: 0,
    processed: 0,
    geoTotal: 0,
    geoDone: 0,
    currentFile: "",
    startedAt: Date.now(),
    finishedAt: null,
  } satisfies IndexProgress);

  const db = getDb();
  try {
    resetIndex();
    // Clear stale thumbnails from previous runs.
    try {
      for (const f of await fs.readdir(THUMBS_DIR)) await fs.rm(path.join(THUMBS_DIR, f));
    } catch {
      /* dir may not exist yet */
    }

    const media = await collectMedia(root);
    progress.total = media.length;

    const insert = db.prepare(`
      INSERT INTO photos (file_path, filename, media_type, album, taken_at, created_at,
        latitude, longitude, location_name, title, description, device_type, thumbnail_path, width, height)
      VALUES (@file_path, @filename, @media_type, @album, @taken_at, @created_at,
        @latitude, @longitude, @location_name, @title, @description, @device_type, @thumbnail_path, @width, @height)
      ON CONFLICT(file_path) DO NOTHING
    `);
    const setThumb = db.prepare("UPDATE photos SET thumbnail_path=@t, width=@w, height=@h WHERE id=@id");

    // Group sidecar JSONs per directory for fallback matching.
    const dirJsonCache = new Map<string, string[]>();
    async function jsonsIn(dir: string): Promise<string[]> {
      if (dirJsonCache.has(dir)) return dirJsonCache.get(dir)!;
      let names: string[] = [];
      try {
        names = (await fs.readdir(dir)).filter(
          (n) => n.toLowerCase().endsWith(".json") && n !== "metadata.json",
        );
      } catch {
        /* ignore */
      }
      dirJsonCache.set(dir, names);
      return names;
    }

    // ---- Phase 1: metadata + thumbnails (no network) ----
    for (const item of media) {
      progress.currentFile = item.filename;
      const ext = path.extname(item.filename).toLowerCase();
      const isVideo = VIDEO_EXT.has(ext);

      // Locate the sidecar JSON.
      const expected = path.join(item.dir, expectedSidecar(item.filename));
      let sidecar = await readJson<Sidecar>(expected);
      if (!sidecar) {
        const candidates = await jsonsIn(item.dir);
        const match = candidates.find((n) => {
          const base = sidecarBase(n);
          return base === item.filename || item.filename.startsWith(base);
        });
        if (match) sidecar = await readJson<Sidecar>(path.join(item.dir, match));
      }

      const taken = sidecar?.photoTakenTime?.timestamp
        ? parseInt(sidecar.photoTakenTime.timestamp, 10)
        : null;
      const created = sidecar?.creationTime?.timestamp
        ? parseInt(sidecar.creationTime.timestamp, 10)
        : null;
      const lat = sidecar?.geoData?.latitude || null;
      const lon = sidecar?.geoData?.longitude || null;
      const hasGeo = lat != null && lon != null && (lat !== 0 || lon !== 0);

      const info = insert.run({
        file_path: item.filePath,
        filename: item.filename,
        media_type: isVideo ? "video" : "image",
        album: item.album,
        taken_at: taken,
        created_at: created,
        latitude: hasGeo ? lat : null,
        longitude: hasGeo ? lon : null,
        location_name: null, // filled in by the geocoding phase
        title: sidecar?.title ?? item.filename,
        description: sidecar?.description || null,
        device_type: sidecar?.googlePhotosOrigin?.mobileUpload?.deviceType ?? null,
        thumbnail_path: null,
        width: null,
        height: null,
      });

      if (info.changes > 0) {
        const id = Number(info.lastInsertRowid);
        const { width, height } = await makeThumb(item, id, isVideo);
        setThumb.run({ t: thumbPath(id), w: width, h: height, id });
      }
      progress.processed++;
    }

    // Index is now browsable — release the UI before geocoding.
    progress.running = false;
    progress.done = true;

    // ---- Phase 2: background reverse-geocoding ----
    await geocodeAll();

    progress.phase = "done";
  } catch (err) {
    progress.error = err instanceof Error ? err.message : String(err);
  } finally {
    progress.running = false;
    progress.geocoding = false;
    progress.finishedAt = Date.now();
    progress.currentFile = "";
    busy = false;
  }
}
