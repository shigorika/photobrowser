"use client";

import { useState } from "react";
import type { Status } from "@/app/types";

export default function SetupScreen({
  status,
  onStarted,
}: {
  status: Status;
  onStarted: () => void;
}) {
  const [path, setPath] = useState(status.rootPath || "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { progress } = status;

  async function start() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Failed to start indexing");
      } else {
        onStarted();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  const pct =
    progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-950 text-neutral-100">
      <div className="w-full max-w-xl">
        <h1 className="text-2xl font-semibold mb-1">Photo Browser</h1>
        <p className="text-neutral-400 mb-6 text-sm">
          Point this at your Google Takeout photos folder and it will build a local
          searchable index.
        </p>

        {progress.running ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Indexing…</span>
              <span className="text-neutral-400">
                {progress.processed} / {progress.total}
              </span>
            </div>
            <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-neutral-500 mt-3 truncate">
              {progress.currentFile || "Scanning folders…"}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Locations are reverse-geocoded in the background once browsing starts.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <label className="block text-sm text-neutral-300 mb-2">
              Absolute path to photos folder
            </label>
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && path && start()}
              placeholder="/Users/you/Takeout/Google Photos"
              className="w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm
                outline-none focus:border-blue-500 font-mono"
            />
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            {progress.error && !error && (
              <p className="text-red-400 text-sm mt-2">
                Previous run failed: {progress.error}
              </p>
            )}
            <button
              onClick={start}
              disabled={!path || submitting}
              className="mt-4 w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40
                disabled:cursor-not-allowed py-2 text-sm font-medium transition-colors"
            >
              {submitting ? "Starting…" : "Index this folder"}
            </button>
            {status.stats.total > 0 && (
              <p className="text-xs text-neutral-500 mt-3">
                Re-indexing will replace the current index of {status.stats.total} items.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
