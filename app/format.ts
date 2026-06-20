import type { Filters } from "./types";

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function fmtDate(ts: number | null): string {
  if (!ts) return "Unknown date";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function fmtDateTime(ts: number | null): string {
  if (!ts) return "Unknown date";
  const d = new Date(ts * 1000);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function filtersToQuery(f: Filters, page = 0, limit = 60): string {
  const sp = new URLSearchParams();
  if (f.album) sp.set("album", f.album);
  if (f.location) sp.set("location", f.location);
  if (f.year) sp.set("year", String(f.year));
  if (f.month) sp.set("month", String(f.month));
  if (f.type) sp.set("type", f.type);
  if (f.q) sp.set("q", f.q);
  sp.set("page", String(page));
  sp.set("limit", String(limit));
  return sp.toString();
}
