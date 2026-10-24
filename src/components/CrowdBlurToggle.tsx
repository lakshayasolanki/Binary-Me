export interface CrowdBlurToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

/** Debug control for the crowd's horizontal motion-blur residue at the final (landed) state. */
export function CrowdBlurToggle({ enabled, onToggle }: CrowdBlurToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-full border border-black/10 bg-(--surface) px-4 py-2 text-sm font-medium text-black shadow-sm transition-colors hover:brightness-95 dark:border-white/15 dark:text-white dark:hover:brightness-125"
      aria-pressed={enabled}
      aria-label="Toggle crowd blur at final state"
    >
      {enabled ? "Crowd blur: on" : "Crowd blur: off"}
    </button>
  );
}
