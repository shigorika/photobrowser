"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Album,
  Filters,
  LocationItem,
  Photo,
  Status,
  TimelineYear,
} from "./types";
import { filtersToQuery, MONTHS } from "./format";
import Sidebar from "@/components/Sidebar";
import FilterBar from "@/components/Filters";
import PhotoGrid from "@/components/PhotoGrid";
import PhotoPreview from "@/components/PhotoPreview";
import SetupScreen from "@/components/SetupScreen";

const PAGE_SIZE = 60;

export default function Page() {
  const [status, setStatus] = useState<Status | null>(null);
  const [forceSetup, setForceSetup] = useState(false);

  const [filters, setFilters] = useState<Filters>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const [albums, setAlbums] = useState<Album[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineYear[]>([]);

  const [lightbox, setLightbox] = useState<number | null>(null);

  // ---- Status polling ----
  const fetchStatus = useCallback(async () => {
    const res = await fetch("/api/index/status");
    const j: Status = await res.json();
    setStatus(j);
    return j;
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ---- Facets (sidebar) ----
  const loadFacets = useCallback(async () => {
    const [a, l, t] = await Promise.all([
      fetch("/api/albums").then((r) => r.json()),
      fetch("/api/locations").then((r) => r.json()),
      fetch("/api/timeline").then((r) => r.json()),
    ]);
    setAlbums(a.albums || []);
    setLocations(l.locations || []);
    setTimeline(t.timeline || []);
  }, []);

  // ---- Photos ----
  const reqId = useRef(0);
  const reloadPhotos = useCallback(async (f: Filters, p: number) => {
    const myReq = ++reqId.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/photos?${filtersToQuery(f, p, PAGE_SIZE)}`);
      const j = await res.json();
      if (myReq !== reqId.current) return; // superseded by a newer request
      setTotal(j.total || 0);
      setHasMore(!!j.hasMore);
      setPage(p);
      setPhotos((prev) => (p === 0 ? j.photos : [...prev, ...j.photos]));
    } finally {
      if (myReq === reqId.current) setLoading(false);
    }
  }, []);

  // Drive the indexing -> geocoding -> done lifecycle.
  const wasRunning = useRef(false);
  const wasActive = useRef(false);
  useEffect(() => {
    if (!status) return;
    const p = status.progress;

    // Indexing finished: reveal the browser and load the grid.
    if (wasRunning.current && !p.running) {
      wasRunning.current = false;
      setForceSetup(false);
      loadFacets();
      reloadPhotos(filters, 0);
    }
    if (p.running) wasRunning.current = true;
    if (p.running || p.geocoding) wasActive.current = true;

    // Keep polling while indexing or background-geocoding.
    if (p.running || p.geocoding) {
      const id = setTimeout(fetchStatus, p.running ? 1000 : 2000);
      // Refresh the sidebar as locations fill in (doesn't disturb the grid).
      if (p.geocoding && !p.running) loadFacets();
      return () => clearTimeout(id);
    }

    // Everything done: final sidebar refresh so all locations show.
    if (wasActive.current) {
      wasActive.current = false;
      loadFacets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.progress.running, status?.progress.geocoding]);

  // Load facets + first page once an index exists.
  const hasIndex = (status?.stats.total ?? 0) > 0;
  useEffect(() => {
    if (hasIndex) {
      loadFacets();
      reloadPhotos(filters, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasIndex]);

  // Refetch page 0 whenever filters change.
  useEffect(() => {
    if (hasIndex) reloadPhotos(filters, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) reloadPhotos(filters, page + 1);
  }, [loading, hasMore, page, filters, reloadPhotos]);

  // ---- Filter mutations ----
  const setScope = useCallback(
    (scope: Partial<Pick<Filters, "album" | "location" | "year" | "month">>) => {
      // Keep orthogonal filters (q, type); replace the sidebar scope.
      setFilters((f) => ({ q: f.q, type: f.type, ...scope }));
      setLightbox(null);
    },
    [],
  );

  const scopeLabel = (() => {
    if (filters.album) return `Album: ${filters.album}`;
    if (filters.location) return `📍 ${filters.location}`;
    if (filters.year && filters.month)
      return `${MONTHS[filters.month - 1]} ${filters.year}`;
    if (filters.year) return `${filters.year}`;
    return null;
  })();

  // ---- Render ----
  if (!status) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-500">
        Loading…
      </div>
    );
  }

  if (forceSetup || status.progress.running || !hasIndex) {
    return <SetupScreen status={status} onStarted={fetchStatus} />;
  }

  return (
    <div className="flex bg-neutral-950 min-h-screen text-neutral-100">
      <Sidebar
        status={status}
        albums={albums}
        locations={locations}
        timeline={timeline}
        filters={filters}
        onScope={setScope}
        onReindex={() => setForceSetup(true)}
      />
      <main className="flex-1 min-w-0">
        {status.progress.geocoding && (
          <div className="bg-blue-950/70 border-b border-blue-900 px-5 py-1.5 text-xs text-blue-200 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Resolving locations in the background…{" "}
            {status.progress.geoDone}/{status.progress.geoTotal} places
          </div>
        )}
        <FilterBar
          filters={filters}
          total={total}
          scopeLabel={scopeLabel}
          onSearch={(q) => setFilters((f) => ({ ...f, q: q || undefined }))}
          onType={(t) => setFilters((f) => ({ ...f, type: t }))}
          onClearScope={() => setScope({})}
        />
        <PhotoGrid
          photos={photos}
          hasMore={hasMore}
          loading={loading}
          onLoadMore={loadMore}
          onOpen={(i) => setLightbox(i)}
        />
      </main>

      {lightbox !== null && photos[lightbox] && (
        <PhotoPreview
          photos={photos}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNavigate={(next) => {
            setLightbox(next);
            if (next >= photos.length - 3 && hasMore && !loading) loadMore();
          }}
        />
      )}
    </div>
  );
}
