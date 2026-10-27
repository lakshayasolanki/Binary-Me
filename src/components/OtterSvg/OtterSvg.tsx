import { useState, type ButtonHTMLAttributes } from "react";
import { OtterArt } from "./OtterArt";
import "./otterSvg.css";

type OtterSvgProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children"> & {
  /** Width in px (or any CSS length). */
  size?: number | string;
  theme?: "light" | "dark";
  /** Opens and closes the mouth while the voice plays. */
  speaking?: boolean;
};

/** Base SVG otter: the sitting, typing pose only. The raster Otter keeps the full pose ladder for now. */
export function OtterSvg({ size = 160, theme = "light", speaking = false, onClick, style, ...rest }: OtterSvgProps) {
  const [clicks, setClicks] = useState(0);
  return (
    <button
      type="button"
      aria-label={speaking ? "Coding otter, speaking" : "Coding otter, typing"}
      {...rest}
      className="otter-svg"
      data-theme={theme}
      data-speaking={speaking}
      data-clicks={clicks}
      style={{ width: size, ...style }}
      onClick={(e) => {
        setClicks((n) => n + 1);
        onClick?.(e);
      }}
    >
      <svg viewBox="286 521 486 423" width="100%" aria-hidden="true" focusable="false">
        <OtterArt />
      </svg>
    </button>
  );
}
