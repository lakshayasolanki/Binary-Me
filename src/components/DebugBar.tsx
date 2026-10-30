import type { BinaryInteractions } from "./BinaryCharacter/binaryRenderer";
import { useState } from "react";
import { CrowdBlurToggle, CrowdCosmicToggle, type CrowdBlurToggleProps } from "./CrowdBlurToggle";
import { ColorPicker, type ColorPickerProps } from "./ColorPicker";
import { DebugMaskToggle, type DebugMaskToggleProps } from "./DebugMaskToggle";
import { GlowSlider, type GlowSliderProps } from "./GlowSlider";

export interface InteractionTogglesProps {
  value: BinaryInteractions;
  onChange: (next: BinaryInteractions) => void;
}

const INTERACTION_LABELS: Record<keyof BinaryInteractions, string> = {
  glow: "Hover glow",
  flip: "Digit flip",
  charge: "Hold charge",
};

export interface DebugBarProps {
  interactions: InteractionTogglesProps;
  mask: DebugMaskToggleProps;
  crowdBlur: CrowdBlurToggleProps;
  crowdCosmic: CrowdBlurToggleProps;
  color: ColorPickerProps;
  glow: GlowSliderProps;
}

/** Dev tools (mask overlay, crowd blur, interaction toggles, color palette, glow) kept together in one bar at the top left,
 *  with a tab button flush against the left edge of the page to show/hide it. */
export function DebugBar({ mask, crowdBlur, crowdCosmic, color, glow, interactions }: DebugBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-pressed={open}
        aria-label="Toggle debug bar"
        title="Toggle debug bar"
        className="fixed top-4 left-0 z-10 grid h-10 w-7 place-items-center rounded-r-full border border-l-0 border-black/10 bg-(--surface) text-xs text-black shadow-sm transition-colors hover:brightness-95 dark:border-white/15 dark:text-white dark:hover:brightness-125"
      >
        {open ? "◀" : "▶"}
      </button>
      {open && (
        <div
          role="toolbar"
          aria-label="Debug tools"
          className="pointer-events-none fixed top-4 left-9 z-10 flex flex-col items-start gap-2 *:pointer-events-auto"
        >
          <DebugMaskToggle {...mask} />
          <CrowdBlurToggle {...crowdBlur} />
          <CrowdCosmicToggle {...crowdCosmic} />
          {(Object.keys(INTERACTION_LABELS) as (keyof BinaryInteractions)[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => interactions.onChange({ ...interactions.value, [key]: !interactions.value[key] })}
              aria-pressed={interactions.value[key]}
              className="rounded-full border border-black/10 bg-(--surface) px-4 py-2 text-sm font-medium text-black shadow-sm transition-colors hover:brightness-95 dark:border-white/15 dark:text-white dark:hover:brightness-125"
            >
              {INTERACTION_LABELS[key]}: {interactions.value[key] ? "on" : "off"}
            </button>
          ))}
          <ColorPicker {...color} />
          <GlowSlider {...glow} />
        </div>
      )}
    </>
  );
}
