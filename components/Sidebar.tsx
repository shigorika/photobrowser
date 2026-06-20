"use client";

import { useMemo, useState } from "react";
import type { Album, Filters, LocationItem, Status, TimelineYear } from "@/app/types";
import { MONTHS } from "@/app/format";

type Scope = Partial<Pick<Filters, "album" | "location" | "year" | "month">>;

export default function Sidebar({
  status,
  albums,
  locations,
  timeline,
  filters,
  onScope,
  onReindex,
}: {
  status: Status;
  albums: Album[];
  locations: LocationItem[];
  timeline: TimelineYear[];
  filters: Filters;
  onScope: (scope: Scope) => void;
  onReindex: () => void;
}) {
  const [locQuery, setLocQuery] = useState("");
  const [openYears, setOpenYears] = useState<Set<number>>(new Set());

  const filteredLocations = useMemo(() => {
    const q = locQuery.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((l) => l.location_name.toLowerCase().includes(q));
  }, [locQuery, locations]);

  const isAll =
    !filters.album && !filters.location && !filters.year && !filters.month;

  function toggleYear(y: number) {
    setOpenYears((prev) => {
      const next = new Set(prev);
      if (next.has(y)) next.delete(y);
      else next.add(y);
      return next;
    });
  }

  return (
    <aside className="w-72 shrink-0 h-screen sticky top-0 overflow-y-auto border-r border-neutral-800 bg-neutral-950 text-neutral-200">
      <div className="p-4 border-b border-neutral-800">
        <h1 className="text-lg font-semibold">Photo Browser</h1>
        <p className="text-xs text-neutral-500 mt-0.5">
          {status.stats.total} items · {status.stats.images} photos ·{" "}
          {status.stats.videos} videos
        </p>
      </div>

      <nav className="p-2 text-sm">
        <button
          onClick={() => onScope({})}
          className={`w-full text-left px-3 py-2 rounded-lg flex justify-between items-center ${
            isAll ? "bg-blue-600 text-white" : "hover:bg-neutral-900"
          }`}
        >
          <span>All photos</span>
          <span className="text-xs opacity-70">{status.stats.total}</span>
        </button>

        <Section title="Timeline">
          {timeline.map((y) => (
            <div key={y.year}>
              <div className="flex items-center">
                <button
                  onClick={() => toggleYear(y.year)}
                  className="px-1.5 py-1 text-neutral-500 hover:text-neutral-200"
                  aria-label="Toggle year"
                >
                  {openYears.has(y.year) ? "▾" : "▸"}
                </button>
                <button
                  onClick={() => onScope({ year: y.year })}
                  className={`flex-1 text-left px-2 py-1 rounded flex justify-between items-center ${
                    filters.year === y.year && !filters.month
                      ? "bg-neutral-800 text-white"
                      : "hover:bg-neutral-900"
                  }`}
                >
                  <span>{y.year}</span>
                  <span className="text-xs text-neutral-500">{y.count}</span>
                </button>
              </div>
              {openYears.has(y.year) && (
                <div className="ml-6">
                  {y.months
                    .slice()
                    .sort((a, b) => b.month - a.month)
                    .map((m) => (
                      <button
                        key={m.month}
                        onClick={() => onScope({ year: y.year, month: m.month })}
                        className={`w-full text-left px-2 py-1 rounded flex justify-between items-center ${
                          filters.year === y.year && filters.month === m.month
                            ? "bg-neutral-800 text-white"
                            : "hover:bg-neutral-900"
                        }`}
                      >
                        <span>{MONTHS[m.month - 1]}</span>
                        <span className="text-xs text-neutral-500">{m.count}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}
          {timeline.length === 0 && (
            <p className="px-2 py-1 text-xs text-neutral-600">No dated items</p>
          )}
        </Section>

        <Section title="Albums">
          {albums.map((a) => (
            <button
              key={a.album}
              onClick={() => onScope({ album: a.album })}
              className={`w-full text-left px-2 py-1 rounded flex justify-between items-center gap-2 ${
                filters.album === a.album
                  ? "bg-neutral-800 text-white"
                  : "hover:bg-neutral-900"
              }`}
            >
              <span className="truncate">{a.album}</span>
              <span className="text-xs text-neutral-500 shrink-0">{a.count}</span>
            </button>
          ))}
          {albums.length === 0 && (
            <p className="px-2 py-1 text-xs text-neutral-600">No albums</p>
          )}
        </Section>

        <Section title="Locations">
          {locations.length > 6 && (
            <input
              value={locQuery}
              onChange={(e) => setLocQuery(e.target.value)}
              placeholder="Filter locations…"
              className="w-full mb-1 rounded bg-neutral-900 border border-neutral-800 px-2 py-1 text-xs
                outline-none focus:border-blue-500"
            />
          )}
          {filteredLocations.map((l) => (
            <button
              key={l.location_name}
              onClick={() => onScope({ location: l.location_name })}
              className={`w-full text-left px-2 py-1 rounded flex justify-between items-center gap-2 ${
                filters.location === l.location_name
                  ? "bg-neutral-800 text-white"
                  : "hover:bg-neutral-900"
              }`}
            >
              <span className="truncate">{l.location_name}</span>
              <span className="text-xs text-neutral-500 shrink-0">{l.count}</span>
            </button>
          ))}
          {locations.length === 0 && (
            <p className="px-2 py-1 text-xs text-neutral-600">No located items</p>
          )}
        </Section>
      </nav>

      <div className="p-3 border-t border-neutral-800 mt-2">
        <button
          onClick={onReindex}
          className="w-full text-xs text-neutral-400 hover:text-neutral-200 px-3 py-2 rounded-lg
            border border-neutral-800 hover:border-neutral-700"
        >
          Re-index folder…
        </button>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="px-3 text-xs font-medium uppercase tracking-wide text-neutral-500 mb-1">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
