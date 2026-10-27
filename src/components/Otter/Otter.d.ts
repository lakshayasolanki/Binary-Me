import type { ButtonHTMLAttributes, JSX, Ref } from 'react';

/** A theme's art set. */
export type OtterTheme = 'light' | 'dark';

/** What the otter is doing (also exposed as `data-state` on the button). */
export type OtterMode = 'greeting' | 'typing' | 'reacting' | 'thinking' | 'sleeping';

/**
 * Every tunable duration and motion amount. Times are ms; `[min, max]` ranges are picked
 * uniformly at random; "px" distances are screen px at size 200 and scale with size.
 */
export interface OtterTiming {
  /** Greeting shows rung 1, then rung 2, each this long. */
  greetingFrameMs: number;
  /** How long each click-ladder rung (1–9) shows. */
  rungMs: readonly number[];
  /** Each grudge reaction (rungs 6 → 7 → 8 → 6 …). */
  grudgeFrameMs: number;
  /** The ladder resets after this long without clicks (not in grudge). */
  ladderDecayMs: number;
  /** A grudge ends after this long without clicks. */
  grudgeMs: number;
  /** Idle (no click/hover/focus, not thinking) → sleeping. */
  sleepAfterMs: number;
  /** First automatic pause after uninterrupted typing. */
  autoThinkAfterMs: number;
  autoThinkDurationMs: number;
  autoThinkRepeatMs: readonly [number, number];
  /** Debounce host busy state and hold its visible pose. */
  thinkingDelayMs: number;
  thinkingMinMs: number;
  /** Pose crossfade + pop. */
  swapMs: number;
  /** Keystrokes per typing burst. */
  burstKeys: readonly [number, number];
  /** Gap between keystrokes in a burst. */
  keyGapMs: readonly [number, number];
  /** Pause between bursts. */
  burstPauseMs: readonly [number, number];
  /** Paw press down / back up. */
  pawDownMs: number;
  pawUpMs: number;
  /** Active paw: down by px, fingertips rotate down by deg around the wrist. */
  pawPressPx: number;
  pawPressDeg: number;
  /** The other paw lifts slightly. */
  pawLiftPx: number;
  /** Chance the same paw strikes twice in a row (0–1). */
  doubleTapChance: number;
  /** Laptop nudge per keystroke, around its bottom center. */
  laptopPressPx: number;
  laptopPressDeg: number;
  /** Mat widening when the laptop goes on the floor. */
  matMs: number;
  /** Light ↔ dark switch total, unless `--otter-theme-duration` is set. */
  themeMs: number;
  /** The otter starts this fraction of the total after the mat (0–1). */
  themeArtLag: number;
  /** Dark mat scale when off; it blooms to 1 when on. */
  themeMatBloom: number;
  /** Typing only: the rung-3 glance once the new theme is visible. */
  themeGlanceMs: number;
  /** prefers-reduced-motion: a single plain fade. */
  themeReducedMs: number;
}

/** Snapshot of the behavior state machine, as passed to `onStateChange`. */
export interface OtterState {
  mode: OtterMode;
  thinkingSource: 'auto' | 'app' | null;
  busy: boolean;
  busyAt: number | null;
  thinkingUntil: number | null;
  autoThinkAt: number | null;
  autoThinkDelay: number;
  /** Reaction frame (1–9) shown while greeting/reacting. */
  frame: number;
  greetStep: number;
  /** Ladder rung on screen (0 = none, or a grudge reaction). */
  rung: number;
  /** Clicks climbed on the ladder. */
  counter: number;
  grudge: boolean;
  grudgeIdx: number;
  /** Absolute times (ms since epoch) of pending deadlines, or null. */
  phaseEndsAt: number | null;
  decayAt: number | null;
  grudgeEndsAt: number | null;
  sleepAt: number | null;
}

/** Methods on the component's ref. */
export interface OtterHandle {
  /** Fall asleep now (ignored while thinking). */
  sleep(): void;
  /** Wake up / count as interaction (resets the idle timer). */
  wake(): void;
  /** Wave hello (the two greeting frames) unless he is reacting to clicks, mid-greeting or thinking for the app. */
  greet(): void;
  /**
   * Warm a theme ahead of a switch, e.g. on the theme toggle's hover: the pose on screen
   * first, then the rest in priority order. Never called automatically.
   */
  prefetchTheme(theme: OtterTheme): void;
}

export interface OtterProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children' | 'aria-label'> {
  /** Otter width: px number or any CSS length. The button hugs the typing pose; other poses overflow it without layout shift. Default 160. */
  size?: number | string;
  /** `'auto'` follows `prefers-color-scheme` live. Default `'auto'`. */
  theme?: 'auto' | OtterTheme;
  /** True while the host app is busy. */
  thinking?: boolean;
  /** Floor mat. `false` = sits directly on the page. Default true. */
  mat?: boolean;
  /** Partial override of {@link OtterTiming}. */
  timing?: Partial<OtterTiming>;
  /** Called with every state-machine change (e.g. for a debug readout). */
  onStateChange?: (state: OtterState) => void;
  ref?: Ref<OtterHandle>;
}

/** A tiny programmer otter who lives in your UI. Renders a `<button>`. */
declare function Otter(props: OtterProps): JSX.Element;
export default Otter;
