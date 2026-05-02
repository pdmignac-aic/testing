"use client";

type Props = {
  catching: boolean;
  onToggle: () => void;
  onCatchNow: () => void;
  catchNowDisabled: boolean;
  catchNowLabel: string;
  accuracyM: number | null;
  nearbyCount: number;
  rollCount: number;
  hasPosition: boolean;
};

function fmtAccuracy(m: number | null): string {
  if (m == null) return "GPS —";
  if (!Number.isFinite(m)) return "GPS —";
  return `GPS ±${Math.round(m)}m`;
}

export default function Controls({
  catching,
  onToggle,
  onCatchNow,
  catchNowDisabled,
  catchNowLabel,
  accuracyM,
  nearbyCount,
  rollCount,
  hasPosition,
}: Props) {
  return (
    <div className="fixed left-0 right-0 bottom-0 z-40 px-4 pb-4 pt-3 bg-gradient-to-t from-cream via-cream/95 to-cream/0">
      <div className="bg-chalk border border-paper shadow-card rounded-xl p-3">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-ash mb-2">
          <span>{hasPosition ? fmtAccuracy(accuracyM) : "Awaiting GPS"}</span>
          <span>
            <span className="text-cobalt font-semibold">{nearbyCount}</span> in range
            <span className="mx-1.5 text-paper">·</span>
            <span className="text-cobalt font-semibold">{rollCount}</span> caught
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCatchNow}
            disabled={catchNowDisabled}
            className="flex-1 border border-cobalt/40 text-cobalt bg-white py-3.5 text-[11px] uppercase tracking-widest font-semibold rounded-lg disabled:opacity-40 active:scale-[0.99] transition-transform"
          >
            {catchNowLabel}
          </button>
          <button
            onClick={onToggle}
            className={`flex-[1.4] py-3.5 text-xs uppercase tracking-widest font-bold rounded-lg active:scale-[0.99] transition-transform ${
              catching
                ? "bg-coral text-chalk shadow-card"
                : "bg-cobalt text-chalk shadow-card hover:bg-cobalt-light"
            }`}
          >
            {catching ? "Stop catching" : "Start catching"}
          </button>
        </div>
      </div>
    </div>
  );
}
