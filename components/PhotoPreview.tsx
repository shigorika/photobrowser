"use client";

import { useEffect } from "react";
import type { Photo } from "@/app/types";
import { fmtDateTime } from "@/app/format";

export default function PhotoPreview({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onNavigate: (next: number) => void;
}) {
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasPrev) onNavigate(index - 1);
      else if (e.key === "ArrowRight" && hasNext) onNavigate(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, hasPrev, hasNext, onClose, onNavigate]);

  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={onClose}>
      {/* Top bar */}
      <div
        className="flex items-start justify-between p-4 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="font-medium truncate">{photo.title || photo.filename}</p>
          <p className="text-xs text-neutral-400">{fmtDateTime(photo.taken_at)}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-4 rounded-full bg-white/10 hover:bg-white/20 w-9 h-9 flex items-center justify-center text-lg"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Media */}
      <div
        className="flex-1 flex items-center justify-center px-4 min-h-0 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {hasPrev && (
          <NavButton side="left" onClick={() => onNavigate(index - 1)} />
        )}
        {photo.media_type === "video" ? (
          <video
            key={photo.id}
            src={`/api/file?id=${photo.id}`}
            controls
            autoPlay
            className="max-h-full max-w-full rounded-lg"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={photo.id}
            src={`/api/file?id=${photo.id}`}
            alt={photo.title || photo.filename}
            className="max-h-full max-w-full object-contain rounded-lg"
          />
        )}
        {hasNext && (
          <NavButton side="right" onClick={() => onNavigate(index + 1)} />
        )}
      </div>

      {/* Metadata footer */}
      <div
        className="p-4 text-sm text-neutral-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-3xl mx-auto flex flex-wrap gap-x-6 gap-y-1">
          {photo.description && (
            <span className="w-full text-neutral-200">{photo.description}</span>
          )}
          {photo.album && <Meta label="Album" value={photo.album} />}
          {photo.location_name && <Meta label="Location" value={photo.location_name} />}
          {photo.width && photo.height && (
            <Meta label="Size" value={`${photo.width}×${photo.height}`} />
          )}
          {photo.device_type && <Meta label="Device" value={photo.device_type} />}
          <Meta label="File" value={photo.filename} />
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-xs">
      <span className="text-neutral-500">{label}: </span>
      <span className="text-neutral-200">{value}</span>
    </span>
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`absolute ${side === "left" ? "left-2" : "right-2"} top-1/2 -translate-y-1/2
        w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl flex items-center justify-center`}
      aria-label={side === "left" ? "Previous" : "Next"}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}
