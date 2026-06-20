import os from "node:os";
import path from "node:path";
import fs from "node:fs";

// All app state lives under ~/.photobrowser (keeps the photos folder untouched).
export const APP_DIR = path.join(os.homedir(), ".photobrowser");
export const DB_PATH = path.join(APP_DIR, "index.db");
export const THUMBS_DIR = path.join(APP_DIR, "thumbnails");
export const CONFIG_PATH = path.join(APP_DIR, "config.json");

export function ensureAppDir() {
  fs.mkdirSync(THUMBS_DIR, { recursive: true });
}

export type Config = { rootPath: string | null };

export function readConfig(): Config {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return { rootPath: null };
  }
}

export function writeConfig(cfg: Config) {
  ensureAppDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

export function thumbPath(id: number) {
  return path.join(THUMBS_DIR, `${id}.jpg`);
}
