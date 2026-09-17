import { useState } from "react";
import { BinaryCharacter } from "./components/BinaryCharacter/BinaryCharacter";
import { DebugMaskToggle } from "./components/DebugMaskToggle";
import { ThemeToggle } from "./components/ThemeToggle";
import { ThemeProvider } from "./theme/ThemeProvider";

const BINARY_COLOR = "#166534";

function AppContent() {
  const [debugMask, setDebugMask] = useState(false);

  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-10 bg-white px-6 py-12 transition-colors duration-300 dark:bg-black lg:flex-row lg:gap-16">
      <ThemeToggle />
      <DebugMaskToggle enabled={debugMask} onToggle={() => setDebugMask((v) => !v)} />
      <div className="flex w-full flex-1 items-center justify-center lg:justify-end">
        <h1 className="font-sf flex flex-col text-6xl leading-[0.95] font-bold tracking-tight text-black transition-colors duration-300 sm:text-7xl lg:text-8xl dark:text-white">
          <span>Lakshaya</span>
          <span>Solanki</span>
        </h1>
      </div>
      <div className="flex w-full flex-1 items-center justify-center lg:justify-start">
        <BinaryCharacter maxWidth={640} binaryColor={BINARY_COLOR} theme="dark" debugMask={debugMask} />
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
