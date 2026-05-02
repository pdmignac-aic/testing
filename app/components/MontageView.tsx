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
    <div className="h-full flex flex-col items-center justify-center px-6 pb-40">
      {status.kind === "idle" && (
        <div className="text-center">
          <p className="text-smoke text-xs uppercase mb-1">Ready to print</p>
          <p className="text-bone text-sm uppercase mb-8">
            {roll.length} frame{roll.length === 1 ? "" : "s"} caught
          </p>
          <button
            onClick={build}
            disabled={roll.length === 0}
            className="bg-blood text-bone px-6 py-4 text-sm font-bold uppercase tracking-widest disabled:opacity-40"
          >
            Make my montage
          </button>
        </div>
      )}

      {status.kind === "rendering" && (
        <div className="text-center">
          <div className="text-blood text-xs uppercase mb-2 animate-pulse">
            Stitching
          </div>
          <p className="text-smoke text-[11px] max-w-[260px]">
            Rolling 15 seconds of footage. Keep this tab visible.
          </p>
        </div>
      )}

      {status.kind === "error" && (
        <div className="text-center">
          <div className="text-blood text-xs uppercase mb-2">Render failed</div>
          <p className="text-smoke text-[11px] mb-6">{status.message}</p>
          <button
            onClick={build}
            className="border border-neutral-800 text-bone px-4 py-3 text-xs uppercase"
          >
            Retry
          </button>
        </div>
      )}

      {status.kind === "ready" && (
        <div className="w-full max-w-xs flex flex-col items-center">
          <video
            src={status.url}
            controls
            playsInline
            autoPlay
            loop
            className="w-full aspect-[9/16] bg-black"
          />
          <div className="flex gap-2 w-full mt-4">
            <button
              onClick={build}
              className="flex-1 border border-neutral-800 text-smoke text-xs py-3 uppercase"
            >
              Re-cut
            </button>
            <button
              onClick={share}
              className="flex-1 bg-bone text-ink text-xs py-3 font-bold uppercase"
            >
              Share
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
