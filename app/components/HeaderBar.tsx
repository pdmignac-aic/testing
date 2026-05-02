"use client";

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
    : "OFF";

  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  const startPress = () => {
    pressTimer = setTimeout(() => {
      onLogoLongPress();
    }, 1200);
  };
  const endPress = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-3 pt-3">
      <div className="flex items-center justify-between text-[10px] uppercase">
        <button
          className="font-bold tracking-widest text-bone select-none"
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
          className={`tracking-widest ${
            catching ? "text-blood" : "text-smoke"
          }`}
        >
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${
              catching ? "bg-blood animate-pulse" : "bg-neutral-700"
            }`}
          />
          {status}
        </div>
      </div>
      <nav className="mt-3 flex bg-black/50 backdrop-blur border border-neutral-900 text-[10px] uppercase">
        {(
          [
            ["map", "Map"],
            ["roll", `Roll (${rollCount})`],
            ["montage", "Montage"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 tracking-widest ${
              mode === m ? "bg-bone text-ink" : "text-smoke"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
