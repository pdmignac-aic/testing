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
      <div className="h-full grid place-items-center text-smoke text-xs px-8 text-center">
        NO CAUGHT FRAMES YET.
        <br />
        START CATCHING OR USE MANUAL CAPTURE.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar pb-40">
      <div className="grid grid-cols-2 gap-1 p-1">
        {roll
          .slice()
          .reverse()
          .map((c) => (
            <button
              key={c.id}
              onClick={() => setOpen(c)}
              className="relative aspect-[4/3] bg-black overflow-hidden text-left grain"
            >
              {urls[c.id] ? (
                <img
                  src={urls[c.id]}
                  alt={c.camName}
                  className="w-full h-full object-cover pixel"
                />
              ) : (
                <div className="w-full h-full bg-neutral-900" />
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-2 pt-6 pb-1.5">
                <div className="text-[9px] text-smoke">{fmt(c.capturedAt)}</div>
                <div className="text-[10px] text-bone truncate">
                  {c.camName.toUpperCase()}
                </div>
              </div>
            </button>
          ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/95 grid place-items-center p-4"
          onClick={() => setOpen(null)}
        >
          <div
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative grain bg-black">
              {urls[open.id] && (
                <img
                  src={urls[open.id]}
                  alt={open.camName}
                  className="w-full pixel"
                />
              )}
            </div>
            <div className="pt-3 text-xs text-smoke">
              <div>{new Date(open.capturedAt).toLocaleString()}</div>
              <div className="text-bone uppercase">{open.camName}</div>
              <div className="text-[10px] mt-1">
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
                className="flex-1 border border-neutral-800 text-smoke text-xs py-3 hover:text-blood hover:border-blood"
              >
                DELETE
              </button>
              <button
                onClick={() => setOpen(null)}
                className="flex-1 bg-bone text-ink text-xs py-3 font-bold"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
