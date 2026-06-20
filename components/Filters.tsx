"use client";

import { useEffect, useState } from "react";
import type { Filters } from "@/app/types";

export default function FilterBar({
  filters,
  total,
  scopeLabel,
  onSearch,
  onType,
  onClearScope,
}: {
  filters: Filters;
  total: number;
  scopeLabel: string | null;
  onSearch: (q: string) => void;
  onType: (t: Filters["type"]) => void;
  onClearScope: () => void;
}) {
  const [text, setText] = useState(filters.q || "");

  // Debounce search input.
  useEffect(() => {
    const id = setTimeout(() => onSearch(text.trim()), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Keep local input in sync if filters.q is cleared elsewhere.
  useEffect(() => {
    if ((filters.q || "") !== text) setText(filters.q || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q]);

  const types: { label: string; value: Filters["type"] }[] = [
    { label: "All", value: undefined },
    { label: "Photos", value: "image" },
    { label: "Videos", value: "video" },
  ];

  return (
    <div className="sticky top-0 z-10 bg-neutral-950/90 backdrop-blur border-b border-neutral-800 px-5 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search filename, title, description…"
          className="flex-1 min-w-[200px] rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm
            outline-none focus:border-blue-500"
        />

        <div className="flex rounded-lg border border-neutral-800 overflow-hidden text-sm">
          {types.map((t) => (
            <button
              key={t.label}
              onClick={() => onType(t.value)}
              className={`px-3 py-2 ${
                (filters.type || undefined) === t.value
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-900 hover:bg-neutral-800 text-neutral-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2 text-sm text-neutral-400">
        {scopeLabel && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 text-neutral-100 px-3 py-1 text-xs">
            {scopeLabel}
            <button
              onClick={onClearScope}
              className="text-neutral-400 hover:text-white"
              aria-label="Clear filter"
            >
              ✕
            </button>
          </span>
        )}
        <span className="text-xs text-neutral-500">
          {total.toLocaleString()} {total === 1 ? "item" : "items"}
        </span>
      </div>
    </div>
  );
}
