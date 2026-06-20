"use client";

import { useEffect, useRef } from "react";
import type { Photo } from "@/app/types";

export default function PhotoGrid({
  photos,
  hasMore,
  loading,
  onLoadMore,
  onOpen,
}: {
  photos: Photo[];
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  onOpen: (index: number) => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) onLoadMore();
      },
      { rootMargin: "600px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, onLoadMore]);

  if (!loading && photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-neutral-500">
        <p className="text-lg">No photos match</p>
        <p className="text-sm mt-1">Try clearing filters or searching for something else.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
        {photos.map((p, i) => (
          <button
            key={p.id}
            onClick={() => onOpen(i)}
            className="group relative aspect-square overflow-hidden rounded-lg bg-neutral-900
              ring-1 ring-neutral-800 hover:ring-blue-500 transition"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/thumbnail?id=${p.id}`}
              alt={p.title || p.filename}
              loading="lazy"
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
            {p.media_type === "video" && (
              <span className="absolute top-1.5 right-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                ▶ video
              </span>
            )}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent
              px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="block truncate text-[11px] text-white">
                {p.location_name || p.album || p.filename}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div ref={sentinel} className="h-12 flex items-center justify-center">
        {loading && <span className="text-sm text-neutral-500">Loading…</span>}
        {!hasMore && photos.length > 0 && (
          <span className="text-xs text-neutral-600">End of results</span>
        )}
      </div>
    </div>
  );
}
