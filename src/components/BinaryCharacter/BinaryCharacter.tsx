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
/** How much the halo (the outer outline) brightens at full hover. On a light backdrop the
 *  halo multiplies, so it is darkened instead to read stronger. */
const HALO_HOVER_GAIN = 0.6;

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
  glowIntensity = 1,
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
  // Color lives outside the main effect's deps: a change recolors the running field in place
  // (see the effect below it) instead of tearing it down and restarting every stream.
  const colorRef = useRef(binaryColor ?? DEFAULT_BINARY_COLOR);
  const recolorRef = useRef<((hex: string) => void) | null>(null);
  // Same idea for glow strength: adjusted live, never a restart.
  const glowIntensityRef = useRef(glowIntensity);
  const controllerRef = useRef<BinaryFieldController | null>(null);

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
      binaryColor: colorRef.current,
      glowIntensity: glowIntensityRef.current,
      direction,
      theme,
    }, (amount) => {
      const level = theme === "light" ? 1 - (HALO_HOVER_GAIN / 2) * amount : 1 + HALO_HOVER_GAIN * amount;
      glowCanvas.style.filter = amount > 0 ? `brightness(${level})` : "";
    });

    let maskBounds: Bounds | null = null;
    let haloLayout: { cssWidth: number; cssHeight: number; bounds: Bounds } | null = null;
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

    function drawHalo() {
      if (!glowCtx || !haloLayout) return;
      const { cssWidth, cssHeight, bounds } = haloLayout;
      renderHalo(glowCtx, maskImage, cssWidth, cssHeight, bounds, colorRef.current, theme);
    }

    controllerRef.current = controller;
    recolorRef.current = (hex) => {
      controller.setColor(hex);
      drawHalo();
    };

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
        haloLayout = { cssWidth, cssHeight, bounds: scaledBounds };
        drawHalo();
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

    function handlePointerMove(event: PointerEvent) {
      const rect = wrapper!.getBoundingClientRect();
      controller.setPointer(event.clientX - rect.left, event.clientY - rect.top);
    }
    function handlePointerLeave() {
      controller.setPointer(null);
    }
    wrapper.addEventListener("pointermove", handlePointerMove);
    wrapper.addEventListener("pointerleave", handlePointerLeave);

    controller.start();

    return () => {
      cancelled = true;
      recolorRef.current = null;
      controllerRef.current = null;
      glowCanvas.style.filter = "";
      resizeObserver.disconnect();
      wrapper.removeEventListener("pointermove", handlePointerMove);
      wrapper.removeEventListener("pointerleave", handlePointerLeave);
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
    direction,
    theme,
  ]);

  useEffect(() => {
    const hex = binaryColor ?? DEFAULT_BINARY_COLOR;
    if (hex === colorRef.current) return;
    colorRef.current = hex;
    recolorRef.current?.(hex);
  }, [binaryColor]);

  useEffect(() => {
    glowIntensityRef.current = glowIntensity;
    controllerRef.current?.setGlowIntensity(glowIntensity);
  }, [glowIntensity]);

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
