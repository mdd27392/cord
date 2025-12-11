import { sdk } from "https://esm.sh/@farcaster/miniapp-sdk";
import { initChordUI } from "./Chord-ui.js";

window.addEventListener("load", () => {
  (async () => {
    initChordUI();

    const envEl = document.getElementById("environment-indicator");
    let isMini = false;

    try {
      isMini = await sdk.isInMiniApp();
    } catch (err) {
      console.error("Failed to detect mini app environment", err);
      if (envEl) {
        envEl.textContent = "Preview mode in browser.";
      }
    }

    if (envEl) {
      if (isMini) {
        envEl.innerHTML = 'Running inside <span>Base Mini App</span>.';
      } else {
        envEl.textContent = "Open in Base to feel the full mini app.";
      }
    }

    try {
      await sdk.actions.ready();
    } catch (err) {
      console.error("Failed to signal ready()", err);
    }
  })();
});
