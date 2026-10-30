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
  const nameBoost = useEasedValue(nameHovered ? 1 : 0);

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
        <p>I have eyes which love to observe human-made things which feel natural.</p>
        <p>I love computers, a machine that can think. So my eyes revolve around computers.</p>
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
