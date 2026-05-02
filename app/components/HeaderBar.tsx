"use client";
import { useRef } from "react";

type Mode = "map" | "roll" | "montage";

type Props = {
  mode: Mode;
  setMode: (m: Mode) => void;
  catching: boolean;
  nearbyCount: number;
  rollCount: number;
  onLogoLongPress: () => void;
};

export default function HeaderBar({
  mode,
  setMode,
  catching,
  nearbyCount,
  rollCount,
  onLogoLongPress,
}: Props) {
  const status = catching
    ? nearbyCount > 0
      ? `IN RANGE · ${nearbyCount}`
      : "CATCHING"
    : "READY";

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPress = () => {
    timerRef.current = setTimeout(() => {
      onLogoLongPress();
    }, 1200);
  };
  const endPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-cream/95 backdrop-blur border-b border-paper">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <button
          className="select-none text-cobalt font-bold text-base tracking-[0.18em]"
          onMouseDown={startPress}
          onMouseUp={endPress}
          onMouseLeave={endPress}
          onTouchStart={startPress}
          onTouchEnd={endPress}
          onTouchCancel={endPress}
          aria-label="caught"
        >
          CAUGHT
        </button>

        <div
          className={`flex items-center gap-2 px-2.5 py-1 rounded-full border text-[10px] tracking-widest ${
            catching
              ? "border-coral/30 bg-coral/10 text-coral"
              : "border-cobalt/20 bg-white/60 text-cobalt"
          }`}
        >
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              catching ? "bg-coral pulse-soft" : "bg-cobalt"
            }`}
          />
          {status}
        </div>
      </div>

      <nav className="px-4 pb-2 flex gap-1">
        {(
          [
            ["map", "Map"],
            ["roll", `Roll · ${rollCount}`],
            ["montage", "Montage"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 text-[11px] tracking-widest uppercase rounded-md transition-colors ${
              mode === m
                ? "bg-cobalt text-chalk shadow-crisp"
                : "text-ink/70 hover:text-cobalt"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
