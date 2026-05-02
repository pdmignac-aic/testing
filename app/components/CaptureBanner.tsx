"use client";

export type BurstState = {
  camId: string;
  camName: string;
  total: number;
  shotsTaken: number;
  phase: "warmup" | "shooting" | "done";
};

type Props = {
  burst: BurstState | null;
};

export default function CaptureBanner({ burst }: Props) {
  if (!burst) return null;

  const headline =
    burst.phase === "warmup"
      ? "YOU'RE ABOUT TO BE CAUGHT"
      : burst.phase === "shooting"
      ? "BEING CAUGHT"
      : "+5 CAUGHT";

  const sub =
    burst.phase === "warmup"
      ? `${burst.camName.toUpperCase()} · ${burst.total} SHOTS INCOMING`
      : burst.phase === "shooting"
      ? `${burst.camName.toUpperCase()} · SHOT ${burst.shotsTaken} OF ${burst.total}`
      : `${burst.camName.toUpperCase()} · ROLL UPDATED`;

  const accent =
    burst.phase === "done" ? "bg-cobalt text-chalk" : "bg-coral text-chalk";

  return (
    <div
      className={`fixed top-[88px] left-3 right-3 z-50 ${accent} rounded-xl shadow-card banner-enter overflow-hidden`}
    >
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest opacity-80">
          <span className="w-1.5 h-1.5 rounded-full bg-current pulse-soft" />
          {headline}
        </div>
        <div className="mt-1 text-[11px] tracking-wider truncate">{sub}</div>
        <div className="mt-2 flex gap-1.5">
          {Array.from({ length: burst.total }).map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${
                i < burst.shotsTaken ? "bg-chalk" : "bg-chalk/25"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
