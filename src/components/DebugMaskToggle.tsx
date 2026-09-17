export interface DebugMaskToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

/**
 * Dev-only control for BinaryCharacter's mask debug overlay (see BinaryCharacter.tsx). Not
 * removed after verification — kept available, off by default, in case the mask or crowd
 * assets ever need a quick re-check.
 */
export function DebugMaskToggle({ enabled, onToggle }: DebugMaskToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="fixed top-4 left-4 z-10 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-medium text-black shadow-sm backdrop-blur transition-colors hover:bg-white dark:border-white/15 dark:bg-black/60 dark:text-white dark:hover:bg-black"
      aria-pressed={enabled}
      aria-label="Toggle person-mask.png debug overlay"
    >
      {enabled ? "Mask debug: on" : "Mask debug: off"}
    </button>
  );
}
