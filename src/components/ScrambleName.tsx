import { useEffect, useRef, type ReactNode } from "react";

const SYMBOLS = Array.from("∑∫∬∂πλΦΨΩβμϑℏ∀∃∄∈∋∉⊗÷∴∵∞√≠≈≡≤≥↗↘↖↔→↓⇕⊥⊨¬∨∪∇ℕℝℤ𝔹𝒩𝒦𝒲𝒜℘[]{}()|~");
const COLORS = ["violet", "blue", "teal", "green", "gold", "pink", "coral"];

/** `inline` renders the name as a single-line span that takes its size from the surrounding text. */
export function ScrambleName({ children, inline = false }: { children?: ReactNode; inline?: boolean }) {
  const heading = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = heading.current;
    if (!root) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cells = Array.from(root.querySelectorAll<HTMLElement>(".scramble-letter"));
    const glyphs = cells.map((cell) => cell.querySelector<HTMLElement>(".scramble-glyph")!);
    const states = cells.map(() => ({ until: 0, next: 0 }));
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;


    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      pointer = null;
      cells.forEach((cell, index) => {
        cell.removeAttribute("data-active");
        states[index].until = 0;
      });
    };

    const animate = (now: number) => {
      let alive = false;
      const radius = parseFloat(getComputedStyle(root).fontSize) * 1.7;
      cells.forEach((cell, index) => {
        const state = states[index];
        if (pointer) {
          const rect = cell.getBoundingClientRect();
          const distance = Math.hypot(pointer.x - rect.left - rect.width / 2, pointer.y - rect.top - rect.height / 2);
          if (distance < radius) state.until = now + 240 + (1 - distance / radius) * 360;
        }
        if (now < state.until) {
          alive = true;
          cell.dataset.active = "true";
          if (now >= state.next) {
            glyphs[index].textContent = Math.random() < 0.25 ? cell.dataset.letter! : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
            cell.dataset.color = COLORS[Math.floor(Math.random() * COLORS.length)];
            cell.dataset.boxed = String(Math.random() < 0.45);
            state.next = now + 100 + Math.random() * 140;
          }
        } else {
          cell.removeAttribute("data-active");
        }
      });
      frame = alive || pointer ? requestAnimationFrame(animate) : 0;
    };

    const move = (event: PointerEvent) => {
      if (preference.matches || event.pointerType === "touch") return;
      pointer = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(animate);
    };
    const leave = () => { pointer = null; };
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerleave", leave);
    root.addEventListener("pointercancel", leave);
    preference.addEventListener("change", reset);
    return () => {
      reset();
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerleave", leave);
      root.removeEventListener("pointercancel", leave);
      preference.removeEventListener("change", reset);
    };
  }, []);

  const words = ["Lakshaya", "Solanki"].map((word, row) => (
    <span key={word} className="scramble-line">
      <span aria-hidden="true" className="scramble-word">
        {Array.from(word).map((letter, index) => (
          <span key={index} className="scramble-letter" data-letter={letter}>
            <span className="scramble-original">{letter}</span>
            <span className="scramble-glyph" />
          </span>
        ))}
      </span>
      {!inline && row === 1 && <span className="scramble-dot">{children}</span>}
    </span>
  ));

  if (inline) {
    return (
      <span ref={heading} className="scramble-name font-mono-name inline-block whitespace-nowrap font-bold text-black transition-colors duration-300 dark:text-white">
        <span className="sr-only">Lakshaya Solanki</span>
        {words[0]}
        <span aria-hidden="true">{" "}</span>
        {words[1]}
        {children}
      </span>
    );
  }

  return (
    <h1 ref={heading as React.RefObject<HTMLHeadingElement>} className="scramble-name font-mono-name flex flex-col items-start text-left text-[clamp(2.75rem,10.5vw,4.5rem)] leading-[1.1] font-medium tracking-[0.03em] text-black transition-colors duration-300 sm:text-[clamp(4rem,9vw,6rem)] lg:text-[clamp(4.5rem,6.5vw,6.25rem)] dark:text-white">
      <span className="sr-only">Lakshaya Solanki</span>
      {words}
    </h1>
  );
}
