// Generates a synthetic Google Photos Takeout export for local development.
//
// Mirrors the real Takeout layout:
//   sample-data/Takeout/Google Photos/<Album>/metadata.json          -> { "title": ... }
//   sample-data/Takeout/Google Photos/<Album>/<file>                 -> media (jpg/mp4)
//   sample-data/Takeout/Google Photos/<Album>/<file>.supplemental-metadata.json
//
// Google truncates the WHOLE sidecar filename to 51 chars while always keeping
// the ".json" tail, so long media names yield ".supplemental-me.json" etc. We
// reproduce that exactly so the indexer's matching logic gets exercised.

import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "sample-data", "Takeout", "Google Photos");

// Two real sample clips downloaded to /tmp during setup.
const VIDEO_SOURCES = ["/tmp/flower.mp4", "/tmp/bunny.mp4"];

// Real coordinates so reverse-geocoding returns sensible names.
const CITIES = {
  reykjavik: { lat: 64.1466, lon: -21.9426, alt: 40 },
  tokyo: { lat: 35.6762, lon: 139.6503, alt: 17 },
  paris: { lat: 48.8566, lon: 2.3522, alt: 35 },
  berlin: { lat: 52.52, lon: 13.405, alt: 34 },
  london: { lat: 51.5074, lon: -0.1278, alt: 11 },
  sf: { lat: 37.7749, lon: -122.4194, alt: 16 },
  ny: { lat: 40.7128, lon: -74.006, alt: 10 },
  sydney: { lat: -33.8688, lon: 151.2093, alt: 19 },
  null: null,
};

// Deterministic pseudo-random so reruns are stable.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const rand = rng(42);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const ts = (iso) => Math.floor(new Date(iso).getTime() / 1000);

// Album definitions: title, optional metadata title override, and a list of shots.
const ALBUMS = [
  {
    folder: "Iceland Road Trip",
    title: "Iceland Road Trip 🇮🇸",
    shots: [
      { city: "reykjavik", date: "2022-07-03T09:14:00Z", desc: "Hallgrímskirkja in the morning light", device: "ANDROID_PHONE" },
      { city: "reykjavik", date: "2022-07-03T18:40:00Z", desc: "Sunset over the harbour", device: "ANDROID_PHONE" },
      { city: "reykjavik", date: "2022-07-04T11:02:00Z", desc: "", device: "ANDROID_PHONE", video: true },
      { city: "reykjavik", date: "2022-07-05T14:25:00Z", desc: "Black sand beach", device: "IOS_PHONE" },
    ],
  },
  {
    folder: "Tokyo 2019",
    title: "Tokyo 2019",
    shots: [
      { city: "tokyo", date: "2019-04-06T08:00:00Z", desc: "Cherry blossoms in Ueno Park", device: "ANDROID_PHONE" },
      { city: "tokyo", date: "2019-04-06T21:30:00Z", desc: "Shinjuku at night", device: "ANDROID_PHONE" },
      { city: "tokyo", date: "2019-04-07T12:15:00Z", desc: "Ramen 🍜", device: "ANDROID_PHONE", longName: true },
      { city: "tokyo", date: "2019-04-08T10:45:00Z", desc: "", device: "ANDROID_PHONE", video: true },
      { city: "tokyo", date: "2019-04-09T16:20:00Z", desc: "Shibuya crossing", device: "ANDROID_PHONE" },
    ],
  },
  {
    folder: "Europe Summer",
    title: "Europe Summer 2023",
    shots: [
      { city: "paris", date: "2023-06-12T13:00:00Z", desc: "Eiffel Tower", device: "IOS_PHONE" },
      { city: "paris", date: "2023-06-13T19:50:00Z", desc: "Seine river cruise", device: "IOS_PHONE" },
      { city: "berlin", date: "2023-06-16T11:30:00Z", desc: "Brandenburg Gate", device: "IOS_PHONE" },
      { city: "berlin", date: "2023-06-17T15:10:00Z", desc: "", device: "IOS_PHONE" },
      { city: "london", date: "2023-06-20T10:00:00Z", desc: "Tower Bridge", device: "IOS_PHONE" },
      { city: "london", date: "2023-06-21T17:45:00Z", desc: "Borough Market", device: "IOS_PHONE", video: true },
    ],
  },
  {
    folder: "Photos from 2021",
    title: "Photos from 2021",
    shots: [
      { city: "sf", date: "2021-02-14T12:00:00Z", desc: "Golden Gate Bridge", device: "ANDROID_PHONE" },
      { city: "sf", date: "2021-05-22T18:30:00Z", desc: "Dolores Park afternoon", device: "ANDROID_PHONE" },
      { city: "ny", date: "2021-09-03T09:20:00Z", desc: "Central Park", device: "ANDROID_PHONE" },
      { city: "ny", date: "2021-11-25T20:00:00Z", desc: "Times Square", device: "ANDROID_PHONE" },
      { city: null, date: "2021-12-25T08:00:00Z", desc: "Christmas morning at home", device: "ANDROID_PHONE" },
    ],
  },
  {
    folder: "Family",
    title: "Family",
    shots: [
      { city: null, date: "2018-08-11T15:00:00Z", desc: "Birthday party", device: "ANDROID_PHONE" },
      { city: null, date: "2020-01-01T00:05:00Z", desc: "New Year fireworks", device: "ANDROID_PHONE", video: true },
      { city: "sydney", date: "2020-02-18T11:30:00Z", desc: "Bondi Beach", device: "ANDROID_PHONE" },
      { city: "sydney", date: "2020-02-19T14:00:00Z", desc: "Opera House", device: "ANDROID_PHONE" },
      { city: null, date: "2024-03-30T13:00:00Z", desc: "Backyard BBQ", device: "IOS_PHONE" },
      // A screenshot sitting in a normal album — detected by filename prefix.
      { city: null, date: "2021-06-15T09:12:00Z", desc: "Recipe I saved", device: "ANDROID_PHONE", screenshot: true },
      // iPhone screenshots: generic IMG_####.PNG names — detected by PNG + no GPS.
      { city: null, date: "2024-05-02T14:22:00Z", desc: "", device: "IOS_PHONE", iosScreenshot: true },
      { city: null, date: "2024-09-13T19:40:00Z", desc: "Concert tickets", device: "IOS_PHONE", iosScreenshot: true },
    ],
  },
  {
    folder: "Screenshots",
    title: "Screenshots",
    shots: [
      { city: null, date: "2022-01-08T22:14:00Z", desc: "", device: "ANDROID_PHONE", screenshot: true },
      { city: null, date: "2022-03-19T11:47:00Z", desc: "Boarding pass", device: "ANDROID_PHONE", screenshot: true },
      { city: null, date: "2023-02-02T18:05:00Z", desc: "", device: "ANDROID_PHONE", screenshot: true },
      { city: null, date: "2023-08-21T08:30:00Z", desc: "Chat", device: "ANDROID_PHONE", screenshot: true },
    ],
  },
];

const PALETTES = [
  ["#1e3a8a", "#60a5fa"], ["#7c2d12", "#fb923c"], ["#14532d", "#4ade80"],
  ["#581c87", "#c084fc"], ["#831843", "#f472b6"], ["#0c4a6e", "#38bdf8"],
  ["#713f12", "#facc15"], ["#3f3f46", "#a1a1aa"],
];

async function makeImage(file, label, sub, seed, ext = "jpg") {
  const [c1, c2] = PALETTES[seed % PALETTES.length];
  const w = 1000 + (seed % 3) * 200;
  const h = 700 + ((seed * 7) % 3) * 180;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="${w * 0.78}" cy="${h * 0.28}" r="${h * 0.16}" fill="#ffffff" fill-opacity="0.18"/>
    <text x="50%" y="46%" font-family="Helvetica,Arial,sans-serif" font-size="${Math.round(w / 16)}"
      fill="#ffffff" text-anchor="middle" font-weight="700">${label}</text>
    <text x="50%" y="58%" font-family="Helvetica,Arial,sans-serif" font-size="${Math.round(w / 36)}"
      fill="#ffffff" fill-opacity="0.85" text-anchor="middle">${sub}</text>
  </svg>`;
  const s = sharp(Buffer.from(svg));
  await (ext === "png" ? s.png() : s.jpeg({ quality: 82 })).toFile(file);
}

// Reproduce Google's sidecar naming: full name truncated to 51 chars, ".json" kept.
function sidecarName(mediaName) {
  const full = `${mediaName}.supplemental-metadata.json`;
  if (full.length <= 51) return full;
  return full.slice(0, 51 - 5).replace(/\.+$/, "") + ".json";
}

async function main() {
  await fs.rm(path.join(__dirname, "..", "sample-data"), { recursive: true, force: true });

  let videoSrcExists = [];
  for (const v of VIDEO_SOURCES) {
    try { await fs.access(v); videoSrcExists.push(v); } catch { /* missing */ }
  }

  let counter = 0, imgCount = 0, vidCount = 0, geoCount = 0;
  let videoCursor = 0;

  for (const album of ALBUMS) {
    const dir = path.join(ROOT, album.folder);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "metadata.json"), JSON.stringify({ title: album.title }, null, 2));

    let n = 0;
    for (const shot of album.shots) {
      counter++; n++;
      const taken = ts(shot.date);
      const created = taken + Math.floor(rand() * 86400); // uploaded sometime later
      const isVideo = shot.video && videoSrcExists.length > 0;

      let base, ext;
      if (isVideo) {
        base = `VID_${shot.date.slice(0, 10).replace(/-/g, "")}_${String(counter).padStart(4, "0")}`;
        ext = "mp4";
      } else if (shot.screenshot) {
        // Android-style screenshot filename (detected by the "Screenshot" prefix).
        base = `Screenshot_${shot.date.slice(0, 10).replace(/-/g, "")}-${String(100000 + counter)}`;
        ext = "png";
      } else if (shot.iosScreenshot) {
        // iPhone screenshot: generic IMG name, PNG, no GPS (detected by PNG+no-geo).
        base = `IMG_${String(3000 + counter)}`;
        ext = "png";
      } else if (shot.longName) {
        base = `IMG_${shot.date.slice(0, 10).replace(/-/g, "")}_long_filename_example_${n}`;
        ext = "jpg";
      } else {
        base = `IMG_${shot.date.slice(0, 10).replace(/-/g, "")}_${String(counter).padStart(4, "0")}`;
        ext = "jpg";
      }
      const mediaName = `${base}.${ext}`;
      const mediaPath = path.join(dir, mediaName);

      if (isVideo) {
        const src = videoSrcExists[videoCursor % videoSrcExists.length];
        videoCursor++;
        await fs.copyFile(src, mediaPath);
        vidCount++;
      } else {
        await makeImage(mediaPath, album.folder, shot.date.slice(0, 10), counter, ext);
        imgCount++;
      }

      const geo = CITIES[shot.city];
      if (geo) geoCount++;
      const sidecar = {
        title: mediaName,
        description: shot.desc || "",
        imageViews: String(Math.floor(rand() * 200)),
        creationTime: { timestamp: String(created), formatted: new Date(created * 1000).toUTCString() },
        photoTakenTime: { timestamp: String(taken), formatted: new Date(taken * 1000).toUTCString() },
        geoData: geo
          ? { latitude: geo.lat, longitude: geo.lon, altitude: geo.alt, latitudeSpan: 0, longitudeSpan: 0 }
          : { latitude: 0, longitude: 0, altitude: 0, latitudeSpan: 0, longitudeSpan: 0 },
        geoDataExif: geo
          ? { latitude: geo.lat, longitude: geo.lon, altitude: geo.alt, latitudeSpan: 0, longitudeSpan: 0 }
          : { latitude: 0, longitude: 0, altitude: 0, latitudeSpan: 0, longitudeSpan: 0 },
        url: `https://photos.google.com/photo/FAKE_${base}`,
        googlePhotosOrigin: { mobileUpload: { deviceType: shot.device } },
      };
      await fs.writeFile(path.join(dir, sidecarName(mediaName)), JSON.stringify(sidecar, null, 2));
    }
  }

  console.log(`Generated ${counter} items across ${ALBUMS.length} albums`);
  console.log(`  images: ${imgCount}, videos: ${vidCount}, with geo: ${geoCount}`);
  console.log(`  root: ${ROOT}`);
  if (videoSrcExists.length === 0) console.log("  (no sample videos found in /tmp — all items are images)");
}

main().catch((e) => { console.error(e); process.exit(1); });
