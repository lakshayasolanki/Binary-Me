import { haptic } from "./haptic";

export interface GlowSliderProps {
  /** Hover glow strength multiplier: 0 (off) to 2 (double), 1 is the default look. */
  value: number;
  onChange: (value: number) => void;
}

/** Adjusts how strongly the binary man lights up on hover (see glowIntensity in binaryRenderer.ts). */
export function GlowSlider({ value, onChange }: GlowSliderProps) {
  const percent = Math.round(value * 100);

  return (
    <label className="flex items-center gap-2 rounded-full border border-black/10 bg-(--surface) px-4 py-2 text-sm font-medium text-black shadow-sm dark:border-white/15 dark:text-white">
      <span>Glow</span>
      <input
        type="range"
        min={0}
        max={200}
        step={5}
        value={percent}
        onChange={(e) => {
          haptic();
          onChange(Number(e.target.value) / 100);
        }}
        aria-label="Hover glow strength"
        aria-valuetext={`${percent}%`}
        className="w-24 cursor-pointer accent-current"
      />
      <span className="w-10 text-right tabular-nums">{percent}%</span>
    </label>
  );
}
