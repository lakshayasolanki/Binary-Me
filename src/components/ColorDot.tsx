import { buildPalette } from "./BinaryCharacter/binaryRenderer";
import { useTheme } from "../theme/ThemeContext";

export interface ColorDotProps {
  value: string;
  onChange: (hex: string) => void;
}

/**
 * The heading's closing full stop, doubling as a color picker for the binary man. It's painted
 * with the palette's glow accent rather than the raw seed (seeds are deep tones that would
 * vanish against a black page), and a transparent native color input sits over it so a click
 * opens the system picker.
 */
export function ColorDot({ value, onChange }: ColorDotProps) {
  const { theme } = useTheme();
  const color = buildPalette(value, theme).glow;

  return (
    <label
      title="Change the binary color"
      className="relative inline-block cursor-pointer rounded-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-current"
      style={{ color }}
    >
      .
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Binary color"
        // Larger than the glyph so the tiny dot is still an easy click/tap target.
        className="absolute -inset-2 h-[calc(100%+1rem)] w-[calc(100%+1rem)] cursor-pointer opacity-0"
      />
    </label>
  );
}
