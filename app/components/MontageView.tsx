"use client";
import { useEffect, useRef, useState } from "react";
import type { Capture } from "@/app/lib/types";
import { generateMontage } from "@/app/lib/montage";

type Props = {
  roll: Capture[];
};

type Status =
  | { kind: "idle" }
  | { kind: "rendering" }
  | { kind: "ready"; url: string; mime: string; blob: Blob }
  | { kind: "error"; message: string };

export default function MontageView({ roll }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  async function build() {
    if (roll.length === 0) {
      setStatus({ kind: "error", message: "ROLL IS EMPTY" });
      return;
    }
    setStatus({ kind: "rendering" });
    try {
      const { blob, mime } = await generateMontage(roll);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setStatus({ kind: "ready", url, mime, blob });
    } catch (e: any) {
      setStatus({ kind: "error", message: e?.message ?? "render failed" });
    }
  }

  async function share() {
    if (status.kind !== "ready") return;
    const ext = status.mime.startsWith("video/mp4") ? "mp4" : "webm";
    const file = new File([status.blob], `caught-${Date.now()}.${ext}`, {
      type: status.mime,
    });
    if (
      typeof navigator !== "undefined" &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: "CAUGHT",
          text: "found footage of my own life",
        });
        return;
      } catch {
        /* fall through to download */
      }
    }
    const a = document.createElement("a");
    a.href = status.url;
    a.download = file.name;
    a.click();
  }

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 pb-44">
      {status.kind === "idle" && (
        <div className="text-center max-w-[300px]">
          <p className="text-ash text-[11px] uppercase tracking-widest mb-1">
            Ready to print
          </p>
          <p className="text-ink text-2xl font-bold uppercase tracking-wide mb-1">
            {roll.length} frame{roll.length === 1 ? "" : "s"}
          </p>
          <p className="text-ash text-[11px] mb-8">
            15-second vertical reel · grainy, cropped, captioned
          </p>
          <button
            onClick={build}
            disabled={roll.length === 0}
            className="bg-cobalt text-chalk px-7 py-4 text-sm font-bold uppercase tracking-widest rounded-lg shadow-card disabled:opacity-40 hover:bg-cobalt-light active:scale-[0.99] transition"
          >
            Make my montage
          </button>
        </div>
      )}

      {status.kind === "rendering" && (
        <div className="text-center">
          <div className="text-cobalt text-xs uppercase tracking-widest mb-2 pulse-soft">
            ◉ Stitching footage
          </div>
          <p className="text-ash text-[11px] max-w-[260px]">
            Rendering 15 seconds. Keep this tab visible.
          </p>
        </div>
      )}

      {status.kind === "error" && (
        <div className="text-center">
          <div className="text-coral text-xs uppercase tracking-widest mb-2">
            Render failed
          </div>
          <p className="text-ash text-[11px] mb-6">{status.message}</p>
          <button
            onClick={build}
            className="border border-cobalt/40 text-cobalt bg-white px-4 py-3 text-xs uppercase tracking-widest rounded-lg"
          >
            Retry
          </button>
        </div>
      )}

      {status.kind === "ready" && (
        <div className="w-full max-w-xs flex flex-col items-center">
          <div className="rounded-xl overflow-hidden shadow-card border border-paper bg-ink">
            <video
              src={status.url}
              controls
              playsInline
              autoPlay
              loop
              className="w-full aspect-[9/16] bg-ink"
            />
          </div>
          <div className="flex gap-2 w-full mt-4">
            <button
              onClick={build}
              className="flex-1 border border-cobalt/30 text-cobalt bg-white text-xs py-3 uppercase tracking-widest rounded-lg"
            >
              Re-cut
            </button>
            <button
              onClick={share}
              className="flex-1 bg-cobalt text-chalk text-xs py-3 font-bold uppercase tracking-widest rounded-lg shadow-card"
            >
              Share
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
