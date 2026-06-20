# Photo Browser — Project Brief

## What we're building

A local desktop-style web app (Next.js) to browse a Google Takeout photo export. The user runs it locally and it indexes their photos folder, then provides a rich browsing UI.

## Source data

Location: `/Users/shigorika/Pictures` (subset now, more to be copied later)

**Folder structure:**
- Each album/folder has a `metadata.json` with just `{ "title": "..." }`
- Each media file has a sidecar JSON: `filename.jpg.supplemental-metadata.json` (sometimes truncated to `*.supplemental-me.json`)

**Sidecar JSON fields:**
- `title` — filename
- `description`
- `imageViews`
- `creationTime.timestamp` — unix epoch (when uploaded to Google Photos)
- `photoTakenTime.timestamp` — unix epoch (actual capture time — prefer this)
- `geoData.latitude`, `geoData.longitude`, `geoData.altitude`
- `url` — google photos URL
- `googlePhotosOrigin.mobileUpload.deviceType` — e.g. `"ANDROID_PHONE"`

No face/people data in the export.

## Tech stack decisions

- **Framework:** Next.js (TypeScript + Tailwind + App Router)
- **Database:** SQLite via `better-sqlite3` — local index of all files + metadata
- **Thumbnails:** `sharp` — generate and cache to a `.thumbnails/` dir
- **Geocoding:** Nominatim (OpenStreetMap, free, no key) — reverse geocode lat/lon → city/country names during indexing, rate-limited to 1 req/sec
- **File serving:** Next.js API routes stream local files (images and videos)

## Features for v1

1. **Folder picker** — user selects root folder on first run; app indexes it into SQLite
2. **Indexing progress** — background indexer with progress indicator
3. **Thumbnail grid** — paginated, lazy-loaded
4. **Browse by date/timeline** — year → month navigation, chronological scroll
5. **Browse by album/folder** — sidebar list of albums (from folder names + metadata.json titles)
6. **Location filter** — reverse-geocoded city/country names; user can type to filter or click from a list
7. **Full-text search** — by filename, title, description
8. **Photo preview** — full-size image lightbox, HTML5 video playback for videos

## Proposed project structure

```
photobrowser/
├── app/
│   ├── api/
│   │   ├── index/route.ts          # POST: start indexing a folder
│   │   ├── index/status/route.ts   # GET: indexing progress
│   │   ├── photos/route.ts         # GET: photos with filters/pagination
│   │   ├── albums/route.ts         # GET: album list
│   │   ├── locations/route.ts      # GET: location name list
│   │   ├── file/route.ts           # GET: stream a local file by path
│   │   └── thumbnail/route.ts      # GET: serve cached thumbnail
│   ├── page.tsx                    # Main app shell
│   └── layout.tsx
├── components/
│   ├── PhotoGrid.tsx
│   ├── Sidebar.tsx
│   ├── PhotoPreview.tsx (lightbox)
│   └── Filters.tsx
├── lib/
│   ├── db.ts                       # SQLite init + schema
│   └── indexer.ts                  # Walks folder, reads JSONs, writes DB, generates thumbnails, geocodes
├── package.json
└── next.config.ts
```

## SQLite schema (planned)

```sql
CREATE TABLE photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT UNIQUE NOT NULL,
  filename TEXT NOT NULL,
  media_type TEXT NOT NULL,        -- 'image' | 'video'
  album TEXT,                      -- parent folder name
  taken_at INTEGER,                -- photoTakenTime.timestamp (preferred)
  created_at INTEGER,              -- creationTime.timestamp
  latitude REAL,
  longitude REAL,
  location_name TEXT,              -- reverse geocoded (city, country)
  title TEXT,
  description TEXT,
  device_type TEXT,
  thumbnail_path TEXT,
  width INTEGER,
  height INTEGER
);

CREATE INDEX idx_taken_at ON photos(taken_at);
CREATE INDEX idx_album ON photos(album);
CREATE INDEX idx_location ON photos(location_name);
CREATE VIRTUAL TABLE photos_fts USING fts5(filename, title, description, content=photos, content_rowid=id);
```

## State to store

- `~/.photobrowser/config.json` or `.photobrowser.db` in the chosen folder — stores the indexed SQLite DB and thumbnail cache path
- Thumbnails cached at `<root>/.photobrowser/thumbnails/<id>.jpg`

## Next steps to implement

1. `npx create-next-app@latest` in this folder
2. Install deps: `better-sqlite3 sharp`
3. Build `lib/db.ts` (schema)
4. Build `lib/indexer.ts` (walk + parse + geocode)
5. Build API routes
6. Build UI components
