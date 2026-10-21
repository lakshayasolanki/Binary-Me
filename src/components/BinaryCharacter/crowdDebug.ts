// On-screen log for devices without an attached console. Enabled with `?debug=1`.
const enabled = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");
let panel: HTMLPreElement | null = null;

export function crowdDebug(message: string) {
  if (!enabled) return;
  if (!panel) {
    panel = document.createElement("pre");
    panel.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;margin:0;padding:6px;max-height:45vh;overflow:auto;background:rgba(0,0,0,.85);color:#7f7;font:10px/1.3 monospace;white-space:pre-wrap;pointer-events:none";
    document.body.appendChild(panel);
  }
  panel.textContent += `${Math.round(performance.now())}ms ${message}\n`;
}
