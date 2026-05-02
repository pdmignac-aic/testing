"use client";

type Props = {
  catching: boolean;
  onToggle: () => void;
  onCatchNow: () => void;
  catchNowDisabled: boolean;
  catchNowLabel: string;
};

export default function Controls({
  catching,
  onToggle,
  onCatchNow,
  catchNowDisabled,
  catchNowLabel,
}: Props) {
  return (
    <div className="fixed left-0 right-0 bottom-0 z-40 px-3 pb-4 pt-3 bg-gradient-to-t from-ink via-ink/85 to-transparent">
      <div className="flex gap-2">
        <button
          onClick={onCatchNow}
          disabled={catchNowDisabled}
          className="flex-1 border border-neutral-800 text-bone py-4 text-[11px] uppercase tracking-widest disabled:opacity-40"
        >
          {catchNowLabel}
        </button>
        <button
          onClick={onToggle}
          className={`flex-[1.4] py-4 text-xs uppercase tracking-widest font-bold ${
            catching ? "bg-blood text-bone" : "bg-bone text-ink"
          }`}
        >
          {catching ? "Stop catching" : "Start catching"}
        </button>
      </div>
    </div>
  );
}
