import { useEffect, useState } from "react";
import { BinaryCharacter } from "./components/BinaryCharacter/BinaryCharacter";
import { DEFAULT_BINARY_COLOR } from "./components/BinaryCharacter/binaryRenderer";
import { ColorDot } from "./components/ColorDot";
import { ColorPicker } from "./components/ColorPicker";
import { DebugMaskToggle } from "./components/DebugMaskToggle";
import { GlowSlider } from "./components/GlowSlider";
import { ThemeToggle } from "./components/ThemeToggle";
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
  const [debugMask, setDebugMask] = useState(false);
  const [binaryColor, setBinaryColor] = useState(loadBinaryColor);
  const [glowIntensity, setGlowIntensity] = useState(loadGlowIntensity);

  const [nameHovered, setNameHovered] = useState(false);
  const nameBoost = useEasedValue(nameHovered ? 1 : 0);

  useEffect(() => saveStored(COLOR_STORAGE_KEY, binaryColor), [binaryColor]);
  useEffect(() => saveStored(GLOW_STORAGE_KEY, String(glowIntensity)), [glowIntensity]);

  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-10 bg-white px-6 py-12 transition-colors duration-300 dark:bg-black lg:flex-row lg:gap-16">
      <ThemeToggle />
      <DebugMaskToggle enabled={debugMask} onToggle={() => setDebugMask((v) => !v)} />
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-10 flex flex-wrap items-center justify-center gap-2 *:pointer-events-auto">
        <ColorPicker value={binaryColor} onChange={setBinaryColor} />
        <GlowSlider value={glowIntensity} onChange={setGlowIntensity} />
      </div>
      <div className="flex w-full flex-1 items-center justify-center lg:justify-end">
        <div
          onPointerEnter={(e) => e.pointerType !== "touch" && setNameHovered(true)}
          onPointerLeave={() => setNameHovered(false)}
        >
        <ScrambleName>
          <ColorDot value={binaryColor} onChange={setBinaryColor} />
        </ScrambleName>
        </div>
      </div>
      <div className="flex w-full flex-1 items-center justify-center lg:justify-start">
        <BinaryCharacter maxWidth={640} binaryColor={binaryColor} glowIntensity={Math.min(2, glowIntensity * (1 + 0.8 * nameBoost))} crowdBlurBoost={3 * nameBoost} theme="dark" debugMask={debugMask} />
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
