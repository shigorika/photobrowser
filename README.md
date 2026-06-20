# Photo Browser

A local desktop-style web app to browse a Google Takeout photo export. It indexes
a photos folder into SQLite, generates thumbnails, reverse-geocodes GPS data, and
gives you a fast browsing UI with timeline / album / location filters and full-text
search.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4)
- **better-sqlite3** — local index + FTS5 full-text search
- **sharp** — thumbnail generation
- **Nominatim** (OpenStreetMap) — reverse geocoding, rate-limited to 1 req/sec

All app state lives in `~/.photobrowser/` (SQLite DB + thumbnail cache). Your photos
folder is never modified.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

On first load, paste the absolute path to your Takeout photos folder
(e.g. `/Users/you/Takeout/Google Photos`) and click **Index this folder**.
Indexing runs in the background with a progress bar; geocoding is the slow part
(1 location/sec, cached so re-indexing is fast).

## Dev data

There's no real Takeout export checked in. Generate a realistic synthetic one:

```bash
npm run gen:data
```

This writes `sample-data/Takeout/Google Photos/` with several albums, real JPEGs,
two short sample videos, and per-file `*.supplemental-metadata.json` sidecars —
including truncated sidecar names and a long-filename case, mirroring real Takeout
quirks. Point the indexer at that folder.

> The sample videos are pulled from the web during generation. If you're offline,
> the generator still produces all the images and simply skips the video items.

## Re-indexing

- **Changed indexing logic only?** Just hit **"Re-index folder…"** in the app. It
  rebuilds photos + thumbnails while keeping the geocode cache (so geocoding stays
  fast).
- **Changed the SQLite schema** in `lib/db.ts`? Wipe local state and start fresh:

  ```bash
  npm run reset   # removes ~/.photobrowser, then restart + re-index
  ```

  (This also clears the geocode cache, so locations re-geocode from scratch.)

## How indexing works

`lib/indexer.ts` walks the folder, and for each media file:

1. Reads the album title from the folder's `metadata.json` (falls back to the
   folder name).
2. Finds the file's sidecar JSON. Google truncates the sidecar filename to 51
   chars while keeping `.json`, so `IMG_….jpg.supplemental-metadata.json` may
   appear as `….supplemental-me.json` or `….suppl.json`. The indexer reproduces
   that truncation rule for an exact match, with a prefix-based fallback.
3. Extracts `photoTakenTime` (preferred), `creationTime`, GPS, description,
   device, etc.
4. Reverse-geocodes GPS → "City, Country" (cached in the `geocode_cache` table).
5. Generates a 400px thumbnail (a placeholder tile for videos, since no ffmpeg).

## Project layout

```
app/
  api/            # index, status, photos, albums, locations, timeline, file, thumbnail
  page.tsx        # main shell (setup vs. browser)
components/        # Sidebar, Filters, PhotoGrid, PhotoPreview, SetupScreen
lib/
  db.ts           # SQLite schema + FTS triggers
  indexer.ts      # walk + parse + geocode + thumbnail
  queries.ts      # photo/album/location/timeline queries
  paths.ts        # ~/.photobrowser locations
scripts/
  gen-fake-data.mjs
```
