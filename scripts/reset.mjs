// Wipes the local index + thumbnail cache (~/.photobrowser).
// Use after changing the SQLite schema, then restart the app and re-index.
//
//   npm run reset

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_DIR = path.join(os.homedir(), ".photobrowser");

try {
  await fs.rm(APP_DIR, { recursive: true, force: true });
  console.log(`Removed ${APP_DIR}`);
  console.log("Restart the app and re-index your folder.");
} catch (e) {
  console.error(`Failed to remove ${APP_DIR}:`, e instanceof Error ? e.message : e);
  process.exit(1);
}
