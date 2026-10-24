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
      className="rounded-full border border-black/10 bg-(--surface) px-4 py-2 text-sm font-medium text-black shadow-sm transition-colors hover:brightness-95 dark:border-white/15 dark:text-white dark:hover:brightness-125"
      aria-pressed={enabled}
      aria-label="Toggle person-mask.png debug overlay"
    >
      {enabled ? "Mask debug: on" : "Mask debug: off"}
    </button>
  );
}
