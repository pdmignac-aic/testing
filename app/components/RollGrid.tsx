"use client";
import { useEffect, useState } from "react";
import type { Capture } from "@/app/lib/types";
import { getBlob, removeCapture } from "@/app/lib/store";

type Props = {
  roll: Capture[];
  onChange: (next: Capture[]) => void;
};

function fmt(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function RollGrid({ roll, onChange }: Props) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Capture | null>(null);

  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    (async () => {
      const next: Record<string, string> = {};
      for (const c of roll) {
        const blob = await getBlob(c.id);
        if (!blob) continue;
        const u = URL.createObjectURL(blob);
        next[c.id] = u;
        made.push(u);
      }
      if (alive) setUrls(next);
    })();
    return () => {
      alive = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [roll]);

  if (roll.length === 0) {
    return (
      <div className="h-full grid place-items-center px-8 text-center">
        <div className="max-w-[280px]">
          <div className="text-cobalt text-xs uppercase tracking-widest mb-2">
            No frames yet
          </div>
          <p className="text-ash text-[11px] leading-relaxed">
            Tap <span className="text-cobalt font-semibold">START CATCHING</span> and
            walk past a NYC traffic cam — or hit{" "}
            <span className="text-cobalt font-semibold">CATCH NOW</span> for an
            instant grab.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar pb-44">
      <div className="grid grid-cols-2 gap-2 p-3">
        {roll
          .slice()
          .reverse()
          .map((c) => (
            <button
              key={c.id}
              onClick={() => setOpen(c)}
              className="relative aspect-[4/3] bg-paper overflow-hidden text-left rounded-lg border border-paper shadow-crisp grain"
            >
              {urls[c.id] ? (
                <img
                  src={urls[c.id]}
                  alt={c.camName}
                  className="w-full h-full object-cover pixel"
                />
              ) : (
                <div className="w-full h-full bg-paper" />
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/85 to-transparent px-2 pt-6 pb-2">
                <div className="text-[9px] text-chalk/70 uppercase tracking-widest">
                  {fmt(c.capturedAt)}
                </div>
                <div className="text-[10px] text-chalk truncate uppercase">
                  {c.camName}
                </div>
              </div>
            </button>
          ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/85 backdrop-blur grid place-items-center p-4"
          onClick={() => setOpen(null)}
        >
          <div
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative grain bg-paper rounded-lg overflow-hidden">
              {urls[open.id] && (
                <img
                  src={urls[open.id]}
                  alt={open.camName}
                  className="w-full pixel"
                />
              )}
            </div>
            <div className="pt-3 text-xs text-chalk/80">
              <div className="text-chalk uppercase font-semibold tracking-wider">
                {open.camName}
              </div>
              <div>{new Date(open.capturedAt).toLocaleString()}</div>
              <div className="text-[10px] mt-1 text-chalk/60">
                {open.lat.toFixed(4)}, {open.lng.toFixed(4)} · {open.source}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={async () => {
                  const next = await removeCapture(open.id);
                  onChange(next);
                  setOpen(null);
                }}
                className="flex-1 border border-coral/40 text-coral bg-ink/40 text-xs py-3 rounded-lg uppercase tracking-widest"
              >
                Delete
              </button>
              <button
                onClick={() => setOpen(null)}
                className="flex-1 bg-chalk text-cobalt text-xs py-3 font-bold rounded-lg uppercase tracking-widest"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
