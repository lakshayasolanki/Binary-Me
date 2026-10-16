/** Seed colors for the binary field. Only hue and saturation really matter — buildPalette
 *  (see binaryRenderer.ts) derives the whole dim -> bright shade ramp from them. */
const COLOR_PRESETS = [
  { name: "Green", hex: "#166534" },
  { name: "Cyan", hex: "#0e7490" },
  { name: "Blue", hex: "#1d4ed8" },
  { name: "Purple", hex: "#7e22ce" },
  { name: "Pink", hex: "#be185d" },
  { name: "Red", hex: "#b91c1c" },
  { name: "Amber", hex: "#b45309" },
] as const;

export interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const isCustom = !COLOR_PRESETS.some((preset) => preset.hex === value);

  return (
    <div
      role="group"
      aria-label="Binary color"
      className="flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-2 shadow-sm backdrop-blur dark:border-white/15 dark:bg-black/60"
    >
      {COLOR_PRESETS.map((preset) => (
        <button
          key={preset.hex}
          type="button"
          onClick={() => onChange(preset.hex)}
          aria-label={preset.name}
          aria-pressed={value === preset.hex}
          title={preset.name}
          className={[
            "size-6 rounded-full transition-transform hover:scale-110",
            value === preset.hex ? "ring-2 ring-black ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-black" : "",
          ].join(" ")}
          style={{ backgroundColor: preset.hex }}
        />
      ))}
      <label
        title="Custom color"
        className={[
          "relative size-6 cursor-pointer overflow-hidden rounded-full transition-transform hover:scale-110",
          isCustom ? "ring-2 ring-black ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-black" : "",
        ].join(" ")}
        style={{
          background: isCustom
            ? value
            : "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
        }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Custom color"
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
