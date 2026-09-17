import { useEffect, useRef } from "react";
import crowdUrl from "../../assets/binary-character/crowd.png";
import maskUrl from "../../assets/binary-character/person-mask.png";
import {
  computeMaskBounds,
  createBinaryField,
  DEFAULT_BINARY_COLOR,
  renderHalo,
  renderMaskFill,
  SOURCE_HEIGHT,
  SOURCE_WIDTH,
  type BinaryFieldController,
  type BinaryFieldOptions,
  type Bounds,
} from "./binaryRenderer";

const DEBUG_MASK_COLOR = "#ff00ff";

export interface BinaryCharacterProps extends BinaryFieldOptions {
  className?: string;
  /** Caps how wide the component can render; it still scales down freely below this. */
  maxWidth?: number | string;
  /** Dev-only: paints person-mask.png as a flat, opaque color using the exact same
   *  drawImage-based mask compositing as the backing and digit field (see renderMaskFill), so
   *  the mask's silhouette can be checked by eye against the crowd photo underneath. Off by
   *  default; the canvas is always laid out, just hidden, so toggling is instant. */
  debugMask?: boolean;
}

/**
 * Static crowd photograph with one silhouette running a continuously animated field of
 * binary digits. The crowd and the silhouette shape never move — only the glyphs inside
 * the silhouette do, driven by a canvas + rAF loop that never touches React state.
 *
 * The silhouette itself — backing, digit field, and the debug overlay — is clipped entirely
 * through canvas compositing (drawImage + `destination-in`, see renderMaskFill and
 * createBinaryField's setMask), not CSS `mask-image`. All three draw from the same source
 * image at the same CSS pixel size, so they can't drift apart from each other or from
 * person-mask.png's own anti-aliased edge. The halo is the one deliberate exception: it stays
 * unclipped so its blur can feather past the silhouette edge as atmosphere, not outline.
 */
export function BinaryCharacter({
  className,
  maxWidth,
  streamCount,
  minSpeed,
  maxSpeed,
  fontSize,
  columnSpacing,
  lineHeight,
  opacity,
  opacityVariance,
  binaryColor,
  direction,
  theme = "dark",
  debugMask = false,
}: BinaryCharacterProps) {
  // `screen` makes the halo read as additive light over a dark backdrop; on a white backdrop
  // that would erase it entirely, so light mode switches to `multiply`, which tints/darkens
  // instead. (The halo itself stays unclipped — see the class doc comment above.)
  const glowStyle = { mixBlendMode: theme === "light" ? ("multiply" as const) : ("screen" as const) };

  const wrapperRef = useRef<HTMLDivElement>(null);
  const backingCanvasRef = useRef<HTMLCanvasElement>(null);
  const glowCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const backingCanvas = backingCanvasRef.current;
    const glowCanvas = glowCanvasRef.current;
    const canvas = canvasRef.current;
    const debugCanvas = debugCanvasRef.current;
    if (!wrapper || !backingCanvas || !glowCanvas || !canvas || !debugCanvas) return;

    const controller: BinaryFieldController = createBinaryField(canvas, {
      streamCount,
      minSpeed,
      maxSpeed,
      fontSize,
      columnSpacing,
      lineHeight,
      opacity,
      opacityVariance,
      binaryColor,
      direction,
      theme,
    });

    let maskBounds: Bounds | null = null;
    let cancelled = false;
    const backingCtx = backingCanvas.getContext("2d");
    const glowCtx = glowCanvas.getContext("2d");
    const ctx = canvas.getContext("2d");
    const debugCtx = debugCanvas.getContext("2d");

    const maskImage = new Image();
    maskImage.onload = () => {
      if (cancelled) return;
      maskBounds = computeMaskBounds(maskImage);
      applyLayout();
    };
    maskImage.src = maskUrl;
    if (maskImage.complete && maskImage.naturalWidth > 0) {
      maskBounds = computeMaskBounds(maskImage);
      applyLayout();
    }

    function applyLayout() {
      if (!maskBounds || !wrapper || !backingCanvas || !glowCanvas || !canvas || !debugCanvas) return;
      const rect = wrapper.getBoundingClientRect();
      const cssWidth = rect.width;
      const cssHeight = rect.height;
      if (cssWidth <= 0 || cssHeight <= 0) return;

      const dpr = window.devicePixelRatio || 1;

      const scale = cssWidth / SOURCE_WIDTH;
      const scaledBounds: Bounds = {
        x: maskBounds.x * scale,
        y: maskBounds.y * scale,
        width: maskBounds.width * scale,
        height: maskBounds.height * scale,
      };
      controller.setBounds(scaledBounds, scale);

      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      controller.setMask(maskImage, cssWidth, cssHeight);

      backingCanvas.width = canvas.width;
      backingCanvas.height = canvas.height;
      if (backingCtx) {
        backingCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderMaskFill(backingCtx, maskImage, cssWidth, cssHeight, "#000000");
      }

      glowCanvas.width = canvas.width;
      glowCanvas.height = canvas.height;
      if (glowCtx) {
        glowCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderHalo(glowCtx, maskImage, cssWidth, cssHeight, scaledBounds, binaryColor ?? DEFAULT_BINARY_COLOR, theme);
      }

      debugCanvas.width = canvas.width;
      debugCanvas.height = canvas.height;
      if (debugCtx) {
        debugCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderMaskFill(debugCtx, maskImage, cssWidth, cssHeight, DEBUG_MASK_COLOR);
      }
    }

    const resizeObserver = new ResizeObserver(() => applyLayout());
    resizeObserver.observe(wrapper);

    controller.start();

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      controller.destroy();
    };
  }, [
    streamCount,
    minSpeed,
    maxSpeed,
    fontSize,
    columnSpacing,
    lineHeight,
    opacity,
    opacityVariance,
    binaryColor,
    direction,
    theme,
  ]);

  return (
    <div
      ref={wrapperRef}
      className={[
        "relative w-full overflow-hidden bg-white dark:bg-black",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ aspectRatio: `${SOURCE_WIDTH} / ${SOURCE_HEIGHT}`, maxWidth }}
    >
      <img
        src={crowdUrl}
        alt=""
        className="absolute inset-0 block h-full w-full pointer-events-none select-none"
        draggable={false}
      />
      {/* Always-black backing behind the silhouette, independent of the page theme, so the
       *  binary field and its halo sit on a consistent dark backdrop. */}
      <canvas
        ref={backingCanvasRef}
        className="absolute inset-0 block h-full w-full pointer-events-none"
      />
      <canvas
        ref={glowCanvasRef}
        className="absolute inset-0 block h-full w-full pointer-events-none"
        style={glowStyle}
      />
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      <canvas
        ref={debugCanvasRef}
        hidden={!debugMask}
        aria-hidden
        className="absolute inset-0 block h-full w-full pointer-events-none"
      />
    </div>
  );
}
