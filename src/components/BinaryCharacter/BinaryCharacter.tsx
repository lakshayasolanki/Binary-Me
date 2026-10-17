import { useEffect, useRef } from "react";
import crowdUrl from "../../assets/binary-character/crowd.png";
import reconstructionUrl from "../../assets/binary-character/reconstruction/background.png";
import gReconstructionUrl from "../../assets/binary-character/reconstruction/G.png";
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
import { createCrowdEntrance, ENTRANCE_DURATION } from "./crowdEntrance";
import { useCrowdFinish } from "./useCrowdFinish";

const DEBUG_MASK_COLOR = "#ff00ff";
/** How much the halo (the outer outline) brightens at full hover. On a light backdrop the
 *  halo multiplies, so it is darkened instead to read stronger. */
const HALO_HOVER_GAIN = 0.6;

export interface BinaryCharacterProps extends BinaryFieldOptions {
  className?: string;
  /** Caps how wide the component can render; it still scales down freely below this. */
  maxWidth?: number | string;
  /** Horizontal photographic motion residue after landing. 0 restores the sharp finish. */
  crowdBlur?: number;
  /** Dev-only: paints person-mask.png as a flat, opaque color using the exact same
   *  drawImage-based mask compositing as the backing and digit field (see renderMaskFill), so
   *  the mask's silhouette can be checked by eye against the crowd photo underneath. Off by
   *  default; the canvas is always laid out, just hidden, so toggling is instant. */
  debugMask?: boolean;
}

/**
 * Seven independently articulated crowd figures settle into the original photograph.
 * The binary silhouette stays fixed throughout; only its interior glyphs keep moving.
 * The entrance has its own short-lived renderer and never restarts for color/theme changes.
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
  crowdBlur = 1,
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
  const crowdImgRef = useRef<HTMLImageElement>(null);
  const crowdBackRef = useRef<HTMLCanvasElement>(null);
  const crowdFrontRef = useRef<HTMLCanvasElement>(null);
  const { definition: finishDefinition, style: finishStyle, setTime: setFinishTime } = useCrowdFinish(crowdBlur, wrapperRef);
  // Reveal either the prepared first pose or the still reference, so the final composition
  // never flashes before the entrance. Normal preparation has a short, bounded deadline.
  useEffect(() => {
    const img = crowdImgRef.current;
    const backCanvas = crowdBackRef.current;
    const frontCanvas = crowdFrontRef.current;
    const wrapper = wrapperRef.current;
    if (!img || !backCanvas || !frontCanvas || !wrapper) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const params = new URLSearchParams(window.location.search);
    const frozen = import.meta.env.DEV ? params.get("crowdT") : null;
    const parsed = frozen === null ? NaN : Number(frozen);
    const freezeAt = Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, ENTRANCE_DURATION) : undefined;
    const beganLoading = performance.now();
    const preparationLimit = 650;
    let cancelled = false;
    let complete = false;
    let preparationTimer: number | undefined;
    let controller: ReturnType<typeof createCrowdEntrance> | null = null;
    const clearPreparationTimer = () => {
      window.clearTimeout(preparationTimer);
      preparationTimer = undefined;
    };
    const preparationExpired = () => freezeAt === undefined && performance.now() - beganLoading >= preparationLimit;
    const settle = () => {
      if (cancelled) return;
      clearPreparationTimer();
      complete = true;
      setFinishTime(ENTRANCE_DURATION);
      img.style.opacity = "1";
      backCanvas.style.opacity = "0";
      frontCanvas.style.opacity = "0";
      wrapper.dataset.crowdPhase = "settled";
      wrapper.style.visibility = "visible";
    };
    const stop = () => {
      if (controller) controller.finish();
      else settle();
    };
    const preferenceChanged = () => { if (preference.matches) stop(); };
    const visibilityChanged = () => { if (document.hidden) stop(); };
    preference.addEventListener("change", preferenceChanged);
    document.addEventListener("visibilitychange", visibilityChanged);

    const load = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Crowd image failed to load"));
      image.src = src;
    });
    if (preference.matches || document.hidden) settle();
    else {
      if (freezeAt === undefined) preparationTimer = window.setTimeout(stop, preparationLimit);
      Promise.all([load(crowdUrl), load(reconstructionUrl), load(gReconstructionUrl), load(maskUrl)])
      .then(([source, background, gDonor, mask]) => {
        if (cancelled || complete) return;
        // Do not surprise someone with a delayed entrance after they have started reading.
        if (preparationExpired()) { settle(); return; }
        controller = createCrowdEntrance({
          backCanvas, frontCanvas, source, background, gDonor, mask,
          freezeAt,
          onlyPerson: import.meta.env.DEV ? params.get("crowdStudy") ?? undefined : undefined,
          onReady: () => {
            if (cancelled || complete) return;
            clearPreparationTimer();
            backCanvas.style.opacity = "1";
            frontCanvas.style.opacity = "1";
            img.style.opacity = "0";
            wrapper.dataset.crowdPhase = freezeAt === undefined ? "playing" : "paused";
            wrapper.style.visibility = "visible";
          },
          onSettled: settle,
          onFrame: setFinishTime,
        });
        // Layer extraction and GPU setup are synchronous, so include them in the deadline too.
        if (preparationExpired()) { controller.finish(); return; }
        controller.start();
      })
      .catch(() => {
        controller?.destroy();
        if (!cancelled) settle();
      });
    }

    return () => {
      cancelled = true;
      clearPreparationTimer();
      preference.removeEventListener("change", preferenceChanged);
      document.removeEventListener("visibilitychange", visibilityChanged);
      controller?.destroy();
    };
  }, [setFinishTime]);

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
      style={{ aspectRatio: `${SOURCE_WIDTH} / ${SOURCE_HEIGHT}`, maxWidth, visibility: "hidden" }}
    >
      {finishDefinition}
      <img
        ref={crowdImgRef}
        src={crowdUrl}
        alt=""
        className="absolute inset-0 block h-full w-full pointer-events-none select-none"
        style={{ opacity: 1, ...finishStyle }}
        draggable={false}
      />
      <canvas
        ref={crowdBackRef}
        aria-hidden
        style={{ opacity: 0, ...finishStyle }}
        className="absolute inset-0 block h-full w-full pointer-events-none"
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
      {/* The moving people draw above the binary man so they cover his backing, digits and halo
       *  while they walk past; hover still reaches the digit canvas beneath. */}
      <canvas
        ref={crowdFrontRef}
        aria-hidden
        style={{ opacity: 0, ...finishStyle }}
        className="absolute inset-0 block h-full w-full pointer-events-none"
      />
      <canvas
        ref={debugCanvasRef}
        hidden={!debugMask}
        aria-hidden
        className="absolute inset-0 block h-full w-full pointer-events-none"
      />
    </div>
  );
}
