import { useTheme } from "../theme/ThemeContext";
import { useAnimating } from "./useAnimating";

/** Plain theme button: "1" = light mode, "0" = dark mode (shows the current theme). */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [animating, animate] = useAnimating();

  return (
    <button
      type="button"
      data-animating={animating}
      onClick={() => {
        animate();
        toggleTheme();
      }}
      className="icon-btn fixed top-4 right-4 z-10 font-mono text-[15px] font-bold"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "0 — dark (click for light)" : "1 — light (click for dark)"}
    >
      {isDark ? "0" : "1"}
    </button>
  );
}
