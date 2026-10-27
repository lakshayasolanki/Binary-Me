# Otter

![The otter typing, waving when clicked, and the lights going down and up again](../../../docs/otter-hero.webp)

## Who he is

A tiny programmer otter who lives in your UI.

He says hi when he first appears — when he scrolls into view, not on page load. Then he gets back to work: typing in bursts, paws alternating on the keys, the odd
double-tap, a pause, more typing. He breathes. Now and then his head bobs.

Click him and he waves. Click again, he waves again. Keep going and his patience runs out by
degrees — a glance, a look, then pointedly ignoring you with growing anger marks — until the
ninth click, when he stands up, puts the laptop down and points at you. After that he holds a
grudge: every click gets the cold shoulder until you leave him alone for 20 seconds.
Leave him alone for eight seconds before that and the slate is wiped clean.

When your app is busy, tell him (`thinking`) and he sets the laptop down and ponders. Ignore
him for 60 seconds and he lies down for a nap; any click, hover or focus wakes him.

He has a light room and a dark room. When the theme changes, the lights change: the floor mat
fades first (in the dark it blooms like a lamp), he follows a beat later, and if he was typing
he glances up. Change your mind halfway and it simply turns back.

He's a `<button>`: Enter and Space work, his label says what he's doing, and the focus ring is
soft. With `prefers-reduced-motion` he still reacts, but nothing moves except quiet crossfades.

## How lean he is

- **Code:** 10.2 KB JS + 1.5 KB CSS, min + gzip (React not included, no other dependencies).
- **Nothing before he's needed.** No image is requested until he's within 200px of the
  viewport. Until then his box is already the right size (from metadata — no layout shift)
  and his mat is drawn in CSS, so there's no blank spot and no spinner.
- **Only what he's wearing.** Only the active theme is ever requested, at the size this screen
  needs (`size × devicePixelRatio`), as AVIF with a WebP fallback. The other theme is never
  fetched unless you switch (or ask for it with `prefetchTheme`).
- **First appearance first.** The greeting frames and the typing layers load first, together;
  the other reactions follow when the browser is idle; thinking and sleeping come last (or
  first, if he's already thinking). If he needs a pose that isn't there yet, it jumps the queue.
- **Never half-drawn.** Every frame is decoded before it's shown. If one isn't ready, he holds
  his current pose — the behavior keeps its own timing, so a click still counts.
- **Idle when unseen.** Typing, breathing and timers pause when the tab is hidden or he's
  scrolled away.

Bytes per theme at the 2× size (an otter ~320 CSS px wide on a retina screen), AVIF:

| | first appearance | reactions 3–9 | thinking + sleeping | total |
|---|---|---|---|---|
| light | 58.3 KB | 138.5 KB | 51.4 KB | **248.2 KB** |
| dark | 76.7 KB | 172.6 KB | 60.5 KB | **309.9 KB** |

At the small size (~160 CSS px at 2×) it's about half: 123.6 KB light, 139.9 KB dark.
Budgets are 60 / 250 KB (light) and 80 / 320 KB (dark); the pipeline picks the AVIF quality
that fits (light q51–53, dark q45 — the dark crayon texture needs more bits).

## Use it

Copy this folder into any React 19 + bundler project (Vite, webpack, Next…). It imports its
images, so your bundler fingerprints them.

```jsx
import Otter from './components/Otter';

<Otter size={160} thinking={isSaving} />
```

TypeScript: types ship alongside (`index.d.ts`, `Otter.d.ts`).

### Props

| prop | type | default | |
|---|---|---|---|
| `size` | `number \| string` | `160` | His width: px or any CSS length. The button hugs his typing pose; standing up, sleeping or setting the laptop down overflow it without moving your layout. |
| `theme` | `'auto' \| 'light' \| 'dark'` | `'auto'` | `'auto'` follows `prefers-color-scheme`, live. |
| `thinking` | `boolean` | `false` | Your app is busy. |
| `mat` | `boolean` | `true` | The floor mat. `false` and he sits straight on your page. |
| `timing` | `Partial<OtterTiming>` | — | Override any duration or motion amount (defaults: `OTTER_TIMING`). |
| `onStateChange` | `(state: OtterState) => void` | — | Every behavior change (mode, ladder counter, grudge, deadlines). |
| `ref` | `Ref<OtterHandle>` | — | See below. |

Other button props (`className`, `style`, `onClick`, …) pass through; `onClick`, `onFocus` and
`onPointerEnter` are called after his own handling.

### Ref

| method | |
|---|---|
| `sleep()` | Nap now (ignored while thinking). |
| `wake()` | Counts as interaction: wakes him, resets the idle timer. |
| `prefetchTheme(theme)` | Warm a theme before a switch — the pose on screen first, then the rest. Call it on your theme toggle's hover/focus. Never automatic. |

### Exports

```js
import Otter, { OTTER_TIMING, prefetchTheme } from './components/Otter';
```

- `OTTER_TIMING` — the default timing table (all fields documented in `Otter.d.ts`).
- `prefetchTheme(theme, { size?, thinking? })` — the ref method without a ref: warms a theme
  for an otter of `size` CSS px. Returns a promise that resolves once loading has started.

## Theming

Set these on the otter or any ancestor:

| custom property | |
|---|---|
| `--otter-mat-light-{center,mid,rim,fade,contact}` | Light mat colors |
| `--otter-mat-dark-{center,mid,rim,fade,contact}` | Dark ("glowing") mat colors |
| `--otter-mat-light-grain`, `--otter-mat-dark-grain` | Paper grain strength (0 = off) |
| `--otter-mat-opacity` | Mat opacity (default 1) |
| `--otter-focus-color` | Focus ring color |
| `--otter-theme-duration` | Length of a light ↔ dark switch (default `600ms`) — match your page's own fade |

The mat defaults are sampled from each theme's artwork and un-mixed from its background, so
they fade to real transparency on any page. Anything named `--_otter-*` is internal.

Styling hooks on the button: `data-state` (`greeting | typing | reacting | thinking |
sleeping`), `data-theme` (the theme on screen), `data-grudge`, `data-paused`.

## The light ↔ dark switch, precisely

1. The new theme's **current pose** loads first (typing: its four layers). Until it's
   decoded the current theme stays fully on screen. Then the rest of that theme loads in the
   usual order.
2. The two mats crossfade (opacity only); going dark, the dark mat also scales 0.94 → 1.
3. One sixth of the duration later (~100ms), he crossfades: same pose, other theme. Both
   themes' typing layers share one container, so his paws stay in step.
4. If he was typing, he glances up (the rung-3 frame, 500ms) once the new theme is visible.
   It's a picture only — the ladder counter, grudge and their timers are untouched. Asleep,
   thinking or mid-reaction: no glance.

Flip back mid-fade and it reverses from where it is. Flip back while the new theme is still
loading and nothing happens at all. If the new theme fails to load, he stays as he is. With
reduced motion it's a single 150ms fade.

## Behavior reference

| click | frame | time |
|---|---|---|
| greeting (on first appearance) | 1 → 2 | 0.6 s each |
| 1, 2 | waving hi | 1.2 s |
| 3 | quick glance | 0.6 s |
| 4 | annoyed look | 1.2 s |
| 5 | ignoring you, annoyed | 1.2 s |
| 6, 7, 8 | ignoring you, angrier each time | 1.0 s |
| 9 | stands up, laptop down, points | 1.8 s → grudge |
| any, in grudge | ignoring you (6 → 7 → 8 → 6 …) | 1.2 s |

A click during a reaction moves straight to the next rung. The ladder resets after 6 s without
clicks; the grudge ends after 20 s without clicks. Clicks during app-driven thinking are ignored. All of
these are in `OTTER_TIMING`.

## Files

| file | |
|---|---|
| `Otter.jsx`, `otter.css` | The component |
| `otterMachine.js` | Behavior state machine (pure) + `OTTER_TIMING` |
| `themeSwitch.js` | Light ↔ dark choreography (pure) |
| `assetPlan.js` | Load order, size tiers, hold-pose rule (pure) |
| `otterAssets.js` | Decode-before-show loader, AVIF detection, `prefetchTheme` |
| `typingRhythm.js` | Keystroke bursts, visibility + reduced-motion hooks |
| `index.js`, `index.d.ts`, `Otter.d.ts` | Entry + types |
| `frameMeta.js`, `assetManifest.js`, `assets/` | **Generated** by `scripts/cut-otter-frames.py` — do not edit |

## Asset map

Everything in `assets/` is generated from `art/` by `scripts/cut-otter-frames.py`
(`npm run art`): keyed, split, normalized to one floor line, tight-cropped, two sizes
(`l` 640px / `s` 320px of otter), AVIF + WebP. `frameMeta.js` holds each image's position,
the layer pivots and the sampled mat colors. Never hand-edit; tune the script and rerun.

| state | asset name | light source (`art/light/`) | dark source (`art/dark/`) |
|---|---|---|---|
| typing (home) | `layer-{base,laptop,paw-left,paw-right}`; flat `typing` as fallback | `normal-state.png` | `normal-state.png` |
| greeting, rungs 1–9 | `reaction-1` … `reaction-9` | `nine-clicks-v2.png` | `nine-clicks.png` (badges removed) |
| grudge | `reaction-6/7/8`, cycled | — | — |
| thinking | `thinking` | `thinking.png` | `thinking.png` |
| sleeping | `sleeping` | `sleeping.png` | `sleeping.png` (zzz kept) |

Files are named `<theme>-<name>-<size>.<avif|webp>`, e.g. `dark-reaction-3-l.avif`.

### Thinking and sleep timing

After 20 seconds of uninterrupted normal typing, he thinks for 3 seconds. Later pauses
follow 25–40 seconds of typing. Hover, focus, or a click interrupts automatic thinking;
clicks still play their normal reaction. Grudges suppress automatic thinking.
Automatic pauses preserve the 60-second inactivity deadline for sleep.

The host `thinking` prop takes priority after a 400 ms delay. Once visible, app-driven
thinking stays for at least 800 ms and until the work finishes. Completing that work
starts a fresh sleep timer. All of these durations can be overridden with `timing`.
