import type { OtterTheme, OtterTiming } from './Otter';

export { default } from './Otter';
export type { OtterHandle, OtterMode, OtterProps, OtterState, OtterTheme, OtterTiming } from './Otter';

/** Defaults for every tunable duration and motion amount (override per instance via `timing`). */
export declare const OTTER_TIMING: Readonly<OtterTiming>;

/**
 * Warm a theme ahead of a switch, e.g. on the theme toggle's hover. Never called
 * automatically. Prefer the component's `ref.prefetchTheme(theme)`, which also loads the
 * pose currently on screen first.
 * @param options.size the otter's width in CSS px (picks the asset tier). Default 160.
 * @returns resolves once loading has started (not finished)
 */
export declare function prefetchTheme(
  theme: OtterTheme,
  options?: { size?: number; thinking?: boolean },
): Promise<void>;
