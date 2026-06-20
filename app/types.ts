// Client-safe types (no server imports).

export type Photo = {
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

export type Album = {
  album: string;
  count: number;
  first_taken: number | null;
  last_taken: number | null;
};

export type LocationItem = { location_name: string; count: number };

export type TimelineYear = {
  year: number;
  count: number;
  months: { month: number; count: number }[];
};

export type Filters = {
  album?: string;
  location?: string;
  year?: number;
  month?: number;
  type?: "image" | "video";
  q?: string;
};

export type IndexProgress = {
  phase: "idle" | "indexing" | "geocoding" | "done";
  running: boolean; // indexing phase active (blocks the browse UI)
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

export type Status = {
  progress: IndexProgress;
  rootPath: string | null;
  stats: { total: number; images: number; videos: number; located: number };
};
