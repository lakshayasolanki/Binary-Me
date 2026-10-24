let label: HTMLLabelElement | null = null;

/** Light tap. iOS Safari 18+ ticks when a `switch` checkbox is toggled by a user gesture, Android uses
 *  `vibrate`. Desktop browsers (macOS included) expose no haptics API, so this is a no-op there. */
export function haptic() {
  if (typeof document === "undefined") return;
  if (navigator.vibrate) {
    navigator.vibrate(8);
    return;
  }
  if (!label) {
    label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    label.appendChild(input);
    document.body.appendChild(label);
  }
  label.click();
}
