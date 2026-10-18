// Review-only source clipping. No image generation, animation, or production asset changes.
// Coordinates follow the user's G annotation, NOT Opus's reversed person-map-v2.
const source = "../crowd.png";
const width = 1671;
const height = 941;

// G is the upper-left crescent behind D. This traces visible head/neck only.
// The neck/body junction is provisional: do not use this as a complete human silhouette.
const gPath = "M 1139 459 L 1181 425 C 1170 407 1159 389 1157 370 C 1146 341 1141 312 1148 281 C 1149 245 1163 216 1176 191 L 1230 176 L 1274 159 C 1300 154 1324 160 1335 179 L 1346 199 L 1378 222 L 1290 222 C 1267 218 1253 222 1243 233 C 1223 254 1216 282 1216 313 C 1216 350 1221 385 1235 417 L 1240 438 L 1197 434 Z";
// Combined right foreground region from the source. E is excluded along the coat edge.
// Subtracting gPath separates the front D region from G without inventing missing pixels.
const rightPath = "M 1110 140 L 1345 140 L 1440 255 L 1462 310 L 1455 400 L 1420 480 L 1370 525 L 1335 520 L 1305 580 L 1300 650 L 1312 800 L 1325 941 L 840 941 L 840 540 L 1100 440 Z";

const people = [
  ["A", 22, 350], ["B", 175, 320], ["F", 370, 320], ["C", 575, 325],
  ["G", 1192, 244], ["D", 1320, 335], ["E", 1540, 325], ["ME", 800, 440],
];

function labelMarkup(selected = "all") {
  return `<g class="labels">${people.filter(([name]) => selected === "all" || name === selected || (selected === "rest" && !["D", "G"].includes(name))).map(([name, x, y]) => {
    const w = name === "ME" ? 84 : 58;
    return `<g class="person-label ${String(name).toLowerCase()}" transform="translate(${x},${y})"><rect x="${-w / 2}" y="-29" width="${w}" height="58" rx="4"/><text y="-1">${name}</text></g>`;
  }).join("")}</g>`;
}

function svgMarkup(id, selection, options = {}) {
  const viewBox = options.closeup ? "1090 140 420 370" : `0 0 ${width} ${height}`;
  const rect = `<rect width="${width}" height="${height}"`;
  const g = `<path d="${gPath}"`;
  const right = `<path d="${rightPath}"`;
  const masks = {
    all: `${rect} fill="white"/>`,
    G: `${g} fill="white"/>`,
    D: `${right} fill="white"/>${g} fill="black"/>`,
    rest: `${rect} fill="white"/>${right} fill="black"/>`,
  };
  // Each view draws the unchanged source exactly once. Masks only control visibility.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${options.title || `Source crowd, ${selection === "all" ? "all people" : selection + " visible region"}`}">
    <defs><mask id="${id}-mask" x="0" y="0" width="${width}" height="${height}" maskUnits="userSpaceOnUse" style="mask-type:luminance">${masks[selection]}</mask></defs>
    <image href="${source}" width="${width}" height="${height}" mask="url(#${id}-mask)"/>
    ${options.outline ? `<path d="${gPath}" fill="none" stroke="#e99838" stroke-width="3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>` : ""}
    ${options.labels === false ? "" : labelMarkup(selection)}
  </svg>`;
}

document.getElementById("person-map").innerHTML = svgMarkup("map", "all", { outline: true, title: "Corrected person map A through G, with G behind D and ME in the middle" });
document.getElementById("g-closeup").innerHTML = svgMarkup("g-detail", "G", { closeup: true, labels: false });
document.getElementById("d-closeup").innerHTML = svgMarkup("d-detail", "D", { closeup: true, labels: false });

const captions = {
  all: "All original people shown together. Nothing has been generated or moved.",
  D: "D’s visible foreground region. G is removed. The lower coat assignment remains provisional; hidden anatomy is not completed.",
  G: "G’s visible head and neck only, in their original position. His body is obscured in the source and has not been invented.",
  rest: "A, B, C, E and F remain visible. D and G are both removed. These are source pixels, not an inpainted background.",
};
function showRegion(selection) {
  document.getElementById("isolation-stage").innerHTML = svgMarkup("isolate", selection);
  document.getElementById("isolation-caption").textContent = captions[selection];
  document.querySelectorAll("[data-isolate]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.isolate === selection)));
}
showRegion("all");
document.querySelectorAll("[data-isolate]").forEach(button => button.addEventListener("click", () => showRegion(button.dataset.isolate)));
const backgrounds = { white: "#ffffff", black: "#000000", magenta: "#ed19f0" };
document.querySelectorAll("[data-background]").forEach(button => button.addEventListener("click", () => {
  document.documentElement.style.setProperty("--stage-bg", backgrounds[button.dataset.background]);
  document.querySelectorAll("[data-background]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
}));
document.getElementById("show-labels").addEventListener("change", event => {
  document.body.classList.toggle("hide-labels", !event.target.checked);
});
