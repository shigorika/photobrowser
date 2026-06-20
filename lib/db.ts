import Database from "better-sqlite3";
import { DB_PATH, ensureAppDir } from "./paths";

export type Photo = {
  id: number;
  file_path: string;
  filename: string;
  media_type: "image" | "video";
  album: string | null;
  taken_at: number | null;
  created_at: number | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  title: string | null;
  description: string | null;
  device_type: string | null;
  thumbnail_path: string | null;
  width: number | null;
  height: number | null;
};

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  ensureAppDir();
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  _db = db;
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT UNIQUE NOT NULL,
      filename TEXT NOT NULL,
      media_type TEXT NOT NULL,
      album TEXT,
      taken_at INTEGER,
      created_at INTEGER,
      latitude REAL,
      longitude REAL,
      location_name TEXT,
      title TEXT,
      description TEXT,
      device_type TEXT,
      thumbnail_path TEXT,
      width INTEGER,
      height INTEGER,
      is_screenshot INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_taken_at ON photos(taken_at);
    CREATE INDEX IF NOT EXISTS idx_album ON photos(album);
    CREATE INDEX IF NOT EXISTS idx_location ON photos(location_name);
    CREATE INDEX IF NOT EXISTS idx_is_screenshot ON photos(is_screenshot);

    CREATE VIRTUAL TABLE IF NOT EXISTS photos_fts USING fts5(
      filename, title, description,
      content='photos', content_rowid='id'
    );

    -- Keep the FTS index in sync with the photos table.
    CREATE TRIGGER IF NOT EXISTS photos_ai AFTER INSERT ON photos BEGIN
      INSERT INTO photos_fts(rowid, filename, title, description)
      VALUES (new.id, new.filename, new.title, new.description);
    END;
    CREATE TRIGGER IF NOT EXISTS photos_ad AFTER DELETE ON photos BEGIN
      INSERT INTO photos_fts(photos_fts, rowid, filename, title, description)
      VALUES ('delete', old.id, old.filename, old.title, old.description);
    END;
    CREATE TRIGGER IF NOT EXISTS photos_au AFTER UPDATE ON photos BEGIN
      INSERT INTO photos_fts(photos_fts, rowid, filename, title, description)
      VALUES ('delete', old.id, old.filename, old.title, old.description);
      INSERT INTO photos_fts(rowid, filename, title, description)
      VALUES (new.id, new.filename, new.title, new.description);
    END;

    -- Cache of reverse-geocoded coordinates so re-indexing is cheap and we
    -- stay within Nominatim's 1 req/sec policy.
    CREATE TABLE IF NOT EXISTS geocode_cache (
      key TEXT PRIMARY KEY,
      name TEXT
    );
  `);

  // Add columns introduced after a DB was first created (CREATE TABLE IF NOT
  // EXISTS won't alter an existing table). Re-index to populate them.
  const cols = db.prepare("PRAGMA table_info(photos)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "is_screenshot")) {
    db.exec("ALTER TABLE photos ADD COLUMN is_screenshot INTEGER NOT NULL DEFAULT 0");
    db.exec("CREATE INDEX IF NOT EXISTS idx_is_screenshot ON photos(is_screenshot)");
  }
}

export function resetIndex() {
  const db = getDb();
  db.exec("DELETE FROM photos;");
  // geocode_cache is intentionally preserved across re-indexes.
}
