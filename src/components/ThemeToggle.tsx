import { useTheme } from "../theme/ThemeContext";
import { useAnimating } from "./useAnimating";

/** Theme button: a sun in light mode, a moon in dark mode (shows the current theme). The rays and the
 *  moon's bite swap with a short rotate/scale so the two read as one icon changing shape. */
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
      className="icon-btn fixed top-4 right-4 z-10"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Dark (click for light)" : "Light (click for dark)"}
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        style={{ transform: isDark ? "rotate(-40deg)" : "rotate(0deg)", transition: "transform 500ms cubic-bezier(.3,1.4,.5,1)" }}
      >
        <mask id="theme-moon-bite">
          <rect width="24" height="24" fill="#fff" />
          <circle cx={isDark ? 16 : 30} cy={isDark ? 8 : 0} r="7" fill="#000" style={{ transition: "cx 500ms ease, cy 500ms ease" }} />
        </mask>
        <circle cx="12" cy="12" r={isDark ? 8 : 4.5} fill="currentColor" stroke="none" mask="url(#theme-moon-bite)" style={{ transition: "r 500ms ease" }} />
        <g style={{ opacity: isDark ? 0 : 1, transformOrigin: "12px 12px", transform: isDark ? "scale(.4)" : "scale(1)", transition: "opacity 300ms, transform 500ms" }}>
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </g>
      </svg>
    </button>
  );
}
