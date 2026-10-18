import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { BinaryCharacter } from "../../src/components/BinaryCharacter/BinaryCharacter";
import { ENTRANCE_DURATION } from "../../src/components/BinaryCharacter/crowdMotion";
import maskUrl from "../../src/assets/binary-character/person-mask.png";
import "../../src/index.css";

const host = document.getElementById("character")!;
const status = document.getElementById("status")!;
const comparison = document.getElementById("comparison")!;
const person = document.getElementById("person") as HTMLSelectElement;
const finishBlur = document.getElementById("finish-blur") as HTMLSelectElement;
const root = createRoot(host);
const formatTime = (time: number) => String(Number(time.toFixed(2)));
document.getElementById("duration")!.textContent = `${formatTime(ENTRANCE_DURATION)} seconds`;
document.querySelectorAll<HTMLButtonElement>("[data-progress]").forEach(button => {
  const time = Number(button.dataset.progress) * ENTRANCE_DURATION;
  button.dataset.time = String(time);
  button.textContent = time === 0 ? "Start" : `${formatTime(time)}s · ${button.dataset.label}`;
});
let revision = 0;
let paused: number | undefined;
const mask = new Image();
mask.src = maskUrl;

function compareFinalFrame() {
  const source = host.querySelector("img")!;
  const [back, front] = host.querySelectorAll<HTMLCanvasElement>("canvas[aria-hidden]");
  if (!back || !front || !mask.complete || !mask.naturalWidth) return;
  const make = () => {
    const canvas = document.createElement("canvas");
    canvas.width = back.width; canvas.height = back.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    return { canvas, ctx };
  };
  const reference = make(), layered = make(), silhouette = make();
  for (const surface of [reference, layered]) {
    surface.ctx.fillStyle = "white";
    surface.ctx.fillRect(0, 0, back.width, back.height);
  }
  reference.ctx.drawImage(source, 0, 0, back.width, back.height);
  layered.ctx.drawImage(back, 0, 0);
  layered.ctx.drawImage(front, 0, 0);
  silhouette.ctx.drawImage(mask, 0, 0, back.width, back.height);
  const read = (ctx: CanvasRenderingContext2D) => ctx.getImageData(0, 0, back.width, back.height).data;
  const a = read(reference.ctx), b = read(layered.ctx), m = read(silhouette.ctx);
  let error = 0, count = 0, large = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (m[i + 3] > 5) continue;
    const delta = (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3;
    error += delta; count++; if (delta > 20) large++;
  }
  comparison.textContent = `Underlying alignment before handoff, outside ME: mean RGB error ${(error / count).toFixed(2)}/255; ${(large / count * 100).toFixed(2)}% of pixels differ by more than 20 levels. This compares source pixels before the experimental finish filter.`;
}

function render() {
  root.render(createElement(BinaryCharacter, { key: revision, crowdBlur: Number(finishBlur.value), binaryColor: "#346b9c", theme: "light", maxWidth: 800 }));
}

function show(time?: number) {
  paused = time;
  const url = new URL(location.href);
  if (time === undefined) url.searchParams.delete("crowdT");
  else url.searchParams.set("crowdT", String(time));
  if (person.value) url.searchParams.set("crowdStudy", person.value);
  else url.searchParams.delete("crowdStudy");
  history.replaceState(null, "", url);
  status.textContent = "Preparing the entrance…";
  comparison.textContent = "";
  document.querySelectorAll<HTMLButtonElement>("[data-time]").forEach(button => {
    button.setAttribute("aria-pressed", String(time === Number(button.dataset.time)));
  });
  revision++;
  render();
}

const observer = new MutationObserver(() => {
  const phase = host.firstElementChild?.getAttribute("data-crowd-phase");
  if (phase === "settled") status.textContent = "Settled · crowd at rest · entrance renderer stopped";
  if (phase === "playing") status.textContent = `Playing · one entrance, ${formatTime(ENTRANCE_DURATION)} seconds`;
  if (phase === "paused") status.textContent = `Paused at ${formatTime(paused ?? 0)}s · ${person.value ? `only ${person.value} displaced` : "all seven people"}`;
  if (phase === "paused" && paused === ENTRANCE_DURATION) compareFinalFrame();
});
observer.observe(host, { subtree: true, attributes: true, attributeFilter: ["data-crowd-phase"] });
document.getElementById("replay")!.addEventListener("click", () => show());
document.querySelectorAll<HTMLButtonElement>("[data-time]").forEach(button => {
  button.addEventListener("click", () => show(Number(button.dataset.time)));
});
person.addEventListener("change", () => show(paused ?? 0.2 * ENTRANCE_DURATION));
finishBlur.addEventListener("change", render);
show();
