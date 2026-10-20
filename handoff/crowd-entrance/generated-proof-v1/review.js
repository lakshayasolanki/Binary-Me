// Share the actual runtime extraction so this review cannot drift from the animation.
import { createCrowdLayers } from "/src/components/BinaryCharacter/crowdLayers.ts";
import sourceUrl from "/src/assets/binary-character/crowd.png";
import backgroundUrl from "/src/assets/binary-character/reconstruction/background.png";
import gUrl from "/src/assets/binary-character/reconstruction/G.png";
import bUrl from "/src/assets/binary-character/reconstruction/B.png";
import gImageUrl from "/src/assets/binary-character/reconstruction/G-uploaded.png";
import dImageUrl from "/src/assets/binary-character/reconstruction/D-uploaded.png";
import cImageUrl from "/src/assets/binary-character/reconstruction/C-uploaded.png";
import maskUrl from "/src/assets/binary-character/person-mask.png";

const people = [["A",22,350],["B",175,320],["F",370,320],["C",575,325],["G",1192,244],["D",1320,335],["E",1540,325]];
const matches = (id, selection) => selection === "all" || id === selection || (selection === "rest" && !["D","G"].includes(id));
let layers = [];
function svgMarkup(selection, closeup = false) {
  const selected = layers.filter(layer => matches(layer.person.id, selection));
  let viewBox = "0 0 1671 941";
  if (closeup && selected.length === 1) {
    const b = selected[0].bounds;
    viewBox = `${b.x - 12} ${b.y - 12} ${b.width + 24} ${b.height + 24}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="Current crowd clipping: ${selection}">
    ${selected.map(({bounds:b,url}) => `<image href="${url}" x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}"/>`).join("")}
    ${closeup ? "" : `<g class="labels">${people.filter(([id]) => matches(id,selection)).map(([id,x,y]) => `<g class="person-label ${id.toLowerCase()}" transform="translate(${x},${y})"><rect x="-29" y="-29" width="58" height="58" rx="4"/><text y="-1">${id}</text></g>`).join("")}</g>`}
  </svg>`;
}
function showRegion(selection) {
  document.getElementById("isolation-stage").innerHTML = svgMarkup(selection);
  document.getElementById("isolation-caption").textContent = selection === "B" ? "B uses your uploaded transparent PNG, at its current animation size and position." : selection === "D" ? "D uses your supplied portrait with a transparent background." : "Current animation layers at their final positions, including concealed-area reconstruction. The binary subject is omitted for inspection.";
  document.querySelectorAll("[data-isolate]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.isolate === selection)));
}
const backgrounds = { white: "#ffffff", black: "#000000", magenta: "#ed19f0" };
document.querySelectorAll("[data-background]").forEach(button => button.addEventListener("click", () => {
  document.documentElement.style.setProperty("--stage-bg", backgrounds[button.dataset.background]);
  document.querySelectorAll("[data-background]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
}));
document.getElementById("show-labels").addEventListener("change", event => document.body.classList.toggle("hide-labels", !event.target.checked));
const load = url => new Promise((resolve,reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("Could not load crowd asset")); image.src = url; });
try {
  const [source, background, g, mask, b, gImage, dImage, cImage] = await Promise.all([sourceUrl,backgroundUrl,gUrl,maskUrl,bUrl,gImageUrl,dImageUrl,cImageUrl].map(load));
  layers = createCrowdLayers(source,background,g,mask,b,gImage,dImage,cImage).map(layer => ({...layer,url:layer.canvas.toDataURL()}));
  document.getElementById("person-map").innerHTML = svgMarkup("all");
  for (const id of ["B","D","G"]) document.getElementById(`${id.toLowerCase()}-closeup`).innerHTML = svgMarkup(id,true);
  document.querySelectorAll("[data-isolate]").forEach(button => button.addEventListener("click", () => showRegion(button.dataset.isolate)));
  showRegion("all");
} catch (error) {
  document.getElementById("isolation-caption").textContent = `Unable to prepare clippings: ${error.message}`;
}
