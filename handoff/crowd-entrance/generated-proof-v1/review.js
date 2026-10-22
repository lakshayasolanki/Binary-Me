// Share the actual runtime extraction so this review cannot drift from the animation.
import { createCrowdLayers, finishCrowdLayer } from "/src/components/BinaryCharacter/crowdLayers.ts";
import { loadCrowdPortraits } from "/src/components/BinaryCharacter/crowdPortraits.ts";
import sourceUrl from "/src/assets/binary-character/crowd.webp";
import backgroundUrl from "/src/assets/binary-character/reconstruction/background.webp";
import gUrl from "/src/assets/binary-character/reconstruction/G.webp";
import bUrl from "/src/assets/binary-character/reconstruction/B.webp";
import gImageUrl from "/src/assets/binary-character/reconstruction/G-uploaded.png";
import dImageUrl from "/src/assets/binary-character/reconstruction/D-uploaded.png";
import cImageUrl from "/src/assets/binary-character/reconstruction/C-uploaded.png";
import maskUrl from "/src/assets/binary-character/person-mask.webp";

const people = [["A",22,350],["B",175,320],["F",370,320],["C",575,325],["G",1192,244],["D",1320,335],["E",1540,325]];
const matches = (id, selection) => selection === "all" || id === selection || (selection === "rest" && !["D","G"].includes(id));
let layers = [];
let originalLayers = [];
let polishedLayers = [];
let selection = "all";
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
function showRegion(nextSelection) {
  selection = nextSelection;
  document.getElementById("isolation-stage").innerHTML = svgMarkup(selection);
  document.getElementById("isolation-caption").textContent = ["B","C","D","E","F"].includes(selection) ? `${selection} uses your transparent upload with its native proportions.${selection === "D" ? " The binary man's overlap is clipped." : ""}` : "Current animation layers at their final positions, including concealed-area reconstruction. The binary subject is omitted for inspection.";
  document.querySelectorAll("[data-isolate]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.isolate === selection)));
}
const backgrounds = { white: "#ffffff", black: "#000000", magenta: "#ed19f0" };
document.querySelectorAll("[data-background]").forEach(button => button.addEventListener("click", () => {
  document.documentElement.style.setProperty("--stage-bg", backgrounds[button.dataset.background]);
  document.querySelectorAll("[data-background]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
}));
document.getElementById("show-labels").addEventListener("change", event => document.body.classList.toggle("hide-labels", !event.target.checked));
function renderReview() {
  layers = document.getElementById("show-polish").checked ? polishedLayers : originalLayers;
  document.getElementById("person-map").innerHTML = svgMarkup("all");
  for (const id of ["B","D","G"]) document.getElementById(`${id.toLowerCase()}-closeup`).innerHTML = svgMarkup(id,true);
  showRegion(selection);
}
document.getElementById("show-polish").addEventListener("change", renderReview);
const load = url => new Promise((resolve,reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("Could not load crowd asset")); image.src = url; });
try {
  const [images, portraits] = await Promise.all([
    Promise.all([sourceUrl,backgroundUrl,gUrl,maskUrl,bUrl,gImageUrl,dImageUrl,cImageUrl].map(load)),
    loadCrowdPortraits(),
  ]);
  const [source, background, g, mask, b, gImage, dImage, cImage] = images;
  const began = performance.now();
  originalLayers = createCrowdLayers(source,background,g,mask,b,gImage,dImage,cImage,{polish:false});
  const extractionMs = performance.now() - began;
  const polishStart = performance.now();
  polishedLayers = originalLayers.map(layer => {
    // The runtime releases temporary source canvases after polishing. Keep this
    // review's baseline independent so its comparison and downloads remain valid.
    const canvas = document.createElement("canvas");
    canvas.width = layer.canvas.width;
    canvas.height = layer.canvas.height;
    canvas.getContext("2d").drawImage(layer.canvas,0,0);
    return finishCrowdLayer({...layer,canvas}, portraits, mask);
  });
  const polishMs = performance.now() - polishStart;
  const measurements = originalLayers.map((layer,index) => {
    const polished = polishedLayers[index];
    const portrait = portraits[layer.person.id];
    const reference = document.createElement("canvas");
    reference.width = portrait?.naturalWidth ?? layer.canvas.width;
    reference.height = portrait?.naturalHeight ?? layer.canvas.height;
    reference.getContext("2d").drawImage(portrait ?? layer.canvas,0,0);
    const before = reference.getContext("2d").getImageData(0,0,reference.width,reference.height).data;
    const after = polished.canvas.getContext("2d").getImageData(0,0,polished.canvas.width,polished.canvas.height).data;
    let alphaChanges = 0, addedAlpha = 0, transparentPixels = 0;
    for (let i = 0; i < before.length; i += 4) {
      if (before[i+3] !== after[i+3]) alphaChanges++;
      if (after[i+3] > before[i+3]) addedAlpha++;
      if (after[i+3] === 0) transparentPixels++;
    }
    const uniformScale = Math.abs(polished.bounds.width / polished.canvas.width - polished.bounds.height / polished.canvas.height) < .001;
    return {id:layer.person.id, alphaChanges, addedAlpha, transparentPixels, uniformScale};
  });
  const verified = measurements.every(result => result.addedAlpha === 0 && result.transparentPixels > 0 && result.uniformScale && (result.id === "D" || result.alphaChanges === 0));
  const report = document.getElementById("polish-verification");
  report.textContent = verified ? "Transparent uploads verified: native edges and proportions retained. D keeps the binary-man overlap cut. Toggle Updated artwork to compare." : "Artwork verification failed. Inspect the affected layer before using this finish.";
  report.dataset.results = JSON.stringify(measurements);
  report.dataset.extractionMs = extractionMs.toFixed(1);
  report.dataset.polishMs = polishMs.toFixed(1);
  originalLayers = originalLayers.map(layer => ({...layer,url:layer.canvas.toDataURL()}));
  polishedLayers = polishedLayers.map(layer => ({...layer,url:layer.canvas.toDataURL()}));
  document.getElementById("layer-downloads").innerHTML = polishedLayers.map(layer =>
    `<a href="${layer.url}" download="person-${layer.person.id}-polished.png">Download ${layer.person.id}</a>`).join("");
  document.querySelectorAll("[data-isolate]").forEach(button => button.addEventListener("click", () => showRegion(button.dataset.isolate)));
  renderReview();
} catch (error) {
  document.getElementById("isolation-caption").textContent = `Unable to prepare clippings: ${error.message}`;
}
