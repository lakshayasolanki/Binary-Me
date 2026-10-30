import { useEffect, useRef, useState } from "react";
import { BinaryCharacter } from "./components/BinaryCharacter/BinaryCharacter";
import { DEFAULT_BINARY_COLOR, DEFAULT_INTERACTIONS } from "./components/BinaryCharacter/binaryRenderer";
import { DebugBar } from "./components/DebugBar";
import { LanguageButton } from "./components/LanguageButton";
import { ThemeToggle } from "./components/ThemeToggle";
import { useTheme } from "./theme/ThemeContext";
import Otter, { type OtterHandle } from "./components/Otter";
import { ThemeProvider } from "./theme/ThemeProvider";
import { ScrambleName } from "./components/ScrambleName";
import { useEasedValue } from "./components/useEasedValue";


import { ComputerIcon } from "./components/ComputerIcon";
import { FallingLeavesIcon } from "./components/FallingLeavesIcon";
import { BubblesIcon } from "./components/BubblesIcon";
import { FlowerIcon } from "./components/FlowerIcon";

// Switch the icon after "natural" here, with the box each one needs.
const NATURAL_ICONS = {
  flower: { Icon: FlowerIcon, box: "h-[1.3em] w-[0.94em] align-[-0.28em]" },
  bubbles: { Icon: BubblesIcon, box: "h-[1.45em] w-[1.2em] align-[-0.18em]" },
  leaves: { Icon: FallingLeavesIcon, box: "h-[1.45em] w-[1.2em] align-[-0.18em]" },
};
const { Icon: NaturalIcon, box: NATURAL_BOX } = NATURAL_ICONS.flower;

const COLOR_STORAGE_KEY = "binary-color";
const GLOW_STORAGE_KEY = "binary-glow";
const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

function loadStored<T>(key: string, parse: (raw: string) => T | null, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw == null ? null : parse(raw);
    if (parsed != null) return parsed;
  } catch {
    // Storage unavailable (private mode, blocked site data) — fall back to the default.
  }
  return fallback;
}

function saveStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Best-effort only.
  }
}

const loadBinaryColor = () =>
  loadStored(COLOR_STORAGE_KEY, (raw) => (HEX_PATTERN.test(raw) ? raw : null), DEFAULT_BINARY_COLOR);

const loadGlowIntensity = () =>
  loadStored(
    GLOW_STORAGE_KEY,
    (raw) => {
      const value = Number(raw);
      return Number.isFinite(value) && value >= 0 && value <= 2 ? value : null;
    },
    1,
  );

function AppContent() {
  const { theme } = useTheme();
  const otter = useRef<OtterHandle>(null);
  const [debugMask, setDebugMask] = useState(false);
  const [crowdBlur, setCrowdBlur] = useState(true);
  const [crowdCosmic, setCrowdCosmic] = useState(false);
  const [interactions, setInteractions] = useState(DEFAULT_INTERACTIONS);
  const [binaryColor, setBinaryColor] = useState(loadBinaryColor);
  const [glowIntensity, setGlowIntensity] = useState(loadGlowIntensity);
  // Hovering the name pushes the crowd further out of focus and lifts the figure's glow a little.
  const [nameHovered, setNameHovered] = useState(false);
  const [computerTapped, setComputerTapped] = useState(false);
  const nameBoost = useEasedValue(nameHovered ? 1 : 0);

  // A touch outside the computer line turns the tapped state back off.
  useEffect(() => {
    if (!computerTapped) return;
    const off = (e: PointerEvent) => {
      if (!(e.target as Element).closest(".computer-host")) setComputerTapped(false);
    };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [computerTapped]);

  useEffect(() => saveStored(COLOR_STORAGE_KEY, binaryColor), [binaryColor]);
  useEffect(() => {
    document.documentElement.style.setProperty("--binary-color", binaryColor);
  }, [binaryColor]);
  useEffect(() => saveStored(GLOW_STORAGE_KEY, String(glowIntensity)), [glowIntensity]);

  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-10 bg-(--surface) px-6 py-16 transition-colors duration-300">
      <ThemeToggle />
      <DebugBar
        interactions={{ value: interactions, onChange: setInteractions }}
        mask={{ enabled: debugMask, onToggle: () => setDebugMask((v) => !v) }}
        crowdBlur={{ enabled: crowdBlur, onToggle: () => setCrowdBlur((v) => !v) }}
        crowdCosmic={{ enabled: crowdCosmic, onToggle: () => setCrowdCosmic((v) => !v) }}
        color={{ value: binaryColor, onChange: setBinaryColor }}
        glow={{ value: glowIntensity, onChange: setGlowIntensity }}
      />
      <div className="flex w-full items-center justify-center">
        <BinaryCharacter key={crowdCosmic ? "cosmic" : "plain"} maxWidth={540} binaryColor={binaryColor} glowIntensity={Math.min(2, glowIntensity * (1 + 0.8 * nameBoost))} theme="dark" debugMask={debugMask} interactions={interactions} crowdBlur={crowdBlur ? 1 : 0} crowdBlurBoost={3 * nameBoost} crowdCosmic={crowdCosmic} />
      </div>
      <div className="font-sf flex w-full max-w-md flex-col gap-5 text-[0.95rem] leading-relaxed text-neutral-500 transition-colors duration-300 dark:text-neutral-400">
        <p className="flex items-center gap-1">
          <span>I'm</span>
          <span
            onPointerEnter={(e) => {
              otter.current?.greet();
              if (e.pointerType !== "touch") setNameHovered(true);
            }}
            onPointerLeave={() => setNameHovered(false)}
          >
            <ScrambleName inline>.</ScrambleName>
          </span>
          <span className="-my-2.5 ml-1 shrink-0">
            <Otter ref={otter} size={42} theme={theme} mat={false} />
          </span>
        </p>
        <p>
          I have eyes which love to observe human-made things which feel{" "}
          <span className="leaves-host water-host group cursor-default whitespace-nowrap">
            <span data-text="natural" className="hover-bold text-black dark:text-white transition-colors duration-300 group-hover:text-[#3342e0] dark:group-hover:text-[#8b98ff] group-hover:font-semibold group-has-[[data-live]]:text-[#3342e0] dark:group-has-[[data-live]]:text-[#8b98ff] group-has-[[data-live]]:font-semibold">natural</span>
            <NaturalIcon className={`ml-[7px] inline-block ${NATURAL_BOX}`} />
          </span>
        </p>
        <p>
          I love{" "}
          <span
            className="computer-host group cursor-default whitespace-nowrap"
            data-active={computerTapped ? "true" : undefined}
            onPointerUp={(e) => { if (e.pointerType === "touch") setComputerTapped((on) => !on); }}
          >
            <span data-text="computers" className="hover-bold text-black dark:text-white transition-colors duration-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:font-semibold group-data-[active=true]:text-emerald-600 dark:group-data-[active=true]:text-emerald-400 group-data-[active=true]:font-semibold">computers</span>
            <ComputerIcon className="ml-1.5 inline-block h-[1.45em] w-[1.4em] align-[-0.3em]" />
          </span>
          , a machine that can think. So my eyes revolve around computers.
        </p>
        <p>Primarily, at this moment, Its all about crafting detailed pixels.</p>
        <div className="flex items-center gap-3">
          <LanguageButton />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
