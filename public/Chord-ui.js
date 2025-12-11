const ROWS = [
  { id: "kick", label: "K", freq: 90 },
  { id: "snare", label: "S", freq: 180 },
  { id: "hat", label: "H", freq: 320 },
  { id: "chime", label: "C", freq: 520 }
];

const STEPS = 8;
const STORAGE_KEY_PREFIX = "chord-loop:";

export function initChordUI() {
  const loopGrid = document.getElementById("loop-grid");
  const gridDay = document.getElementById("grid-day");
  const stepIndicators = document.getElementById("step-indicators");
  const statusText = document.getElementById("status-text");
  const loopState = document.getElementById("loop-state");
  const btnPlay = document.getElementById("btn-play");
  const btnClear = document.getElementById("btn-clear");

  if (!loopGrid || !gridDay || !stepIndicators || !statusText || !btnPlay || !btnClear || !loopState) {
    return;
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const STORAGE_KEY = STORAGE_KEY_PREFIX + todayKey;

  // Render day label
  const now = new Date();
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
  gridDay.textContent = formatter.format(now);

  // Matrix state: rows x steps
  let matrix = createEmptyMatrix();
  let isPlaying = false;
  let currentStep = 0;
  let timerId = null;
  let audioCtx = null;

  // Build grid of pads
  loopGrid.innerHTML = "";
  const pads = [];
  for (let r = 0; r < ROWS.length; r++) {
    for (let s = 0; s < STEPS; s++) {
      const pad = document.createElement("button");
      pad.type = "button";
      pad.className = "pad " + ROWS[r].id;
      pad.dataset.row = String(r);
      pad.dataset.step = String(s);
      pad.innerHTML = `<span>${s + 1}</span>`;

      pad.addEventListener("click", () => {
        togglePad(r, s);
      });

      loopGrid.appendChild(pad);
      pads.push(pad);
    }
  }

  const indicatorSpans = Array.from(stepIndicators.querySelectorAll("span"));

  function createEmptyMatrix() {
    return Array.from({ length: ROWS.length }, () => Array(STEPS).fill(false));
  }

  function loadMatrix() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length !== ROWS.length) return;
      matrix = parsed.map((row) => {
        if (!Array.isArray(row) || row.length !== STEPS) {
          return Array(STEPS).fill(false);
        }
        return row.map((v) => Boolean(v));
      });
      updatePadsFromMatrix();
      updateStatus();
      loopState.textContent = "Saved for today";
    } catch (err) {
      console.error("Failed to load chord loop", err);
    }
  }

  function saveMatrix() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(matrix));
      loopState.textContent = "Saved for today";
    } catch (err) {
      console.error("Failed to save chord loop", err);
    }
  }

  function togglePad(row, step) {
    matrix[row][step] = !matrix[row][step];
    updatePad(row, step);
    updateStatus();
    loopState.textContent = "Unsaved live loop";
  }

  function updatePad(row, step) {
    const pad = loopGrid.querySelector(`.pad[data-row="${row}"][data-step="${step}"]`);
    if (!pad) return;
    if (matrix[row][step]) {
      pad.classList.add("on");
    } else {
      pad.classList.remove("on");
    }
  }

  function updatePadsFromMatrix() {
    for (let r = 0; r < ROWS.length; r++) {
      for (let s = 0; s < STEPS; s++) {
        updatePad(r, s);
      }
    }
  }

  function countActive() {
    let total = 0;
    for (let r = 0; r < ROWS.length; r++) {
      for (let s = 0; s < STEPS; s++) {
        if (matrix[r][s]) total++;
      }
    }
    return total;
  }

  function updateStatus() {
    const total = countActive();
    const phrase = isPlaying ? "Playing" : "Stopped";
    statusText.textContent = `${phrase} · ${total} active steps`;
  }

  function highlightStep(step) {
    indicatorSpans.forEach((span, idx) => {
      if (idx === step) {
        span.classList.add("active");
      } else {
        span.classList.remove("active");
      }
    });
  }

  function clearHighlight() {
    indicatorSpans.forEach((span) => span.classList.remove("active"));
  }

  function initAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
  }

  function triggerSound(rowIdx) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const baseFreq = ROWS[rowIdx].freq;
    osc.frequency.value = baseFreq;
    osc.type = rowIdx === 0 ? "sine" : rowIdx === 1 ? "triangle" : rowIdx === 2 ? "square" : "sawtooth";
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  function step() {
    highlightStep(currentStep);

    for (let r = 0; r < ROWS.length; r++) {
      if (matrix[r][currentStep]) {
        triggerSound(r);
      }
    }

    currentStep = (currentStep + 1) % STEPS;
  }

  function start() {
    if (isPlaying) return;
    initAudioContext();
    if (!audioCtx) {
      statusText.textContent = "Audio not supported in this browser.";
      return;
    }
    isPlaying = true;
    currentStep = 0;
    step();
    const intervalMs = 500; // 120 bpm for 8 steps ish
    timerId = window.setInterval(step, intervalMs);
    btnPlay.textContent = "Stop loop";
    updateStatus();
  }

  function stop() {
    if (!isPlaying) return;
    isPlaying = false;
    if (timerId != null) {
      window.clearInterval(timerId);
      timerId = null;
    }
    clearHighlight();
    btnPlay.textContent = "Play loop";
    updateStatus();
  }

  btnPlay.addEventListener("click", () => {
    if (isPlaying) {
      stop();
    } else {
      start();
    }
  });

  btnClear.addEventListener("click", () => {
    stop();
    matrix = createEmptyMatrix();
    updatePadsFromMatrix();
    updateStatus();
    loopState.textContent = "Unsaved live loop";
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error("Failed to clear saved loop", err);
    }
  });

  // Save when page is hidden or before unload
  const saveHandler = () => {
    if (countActive() > 0) {
      saveMatrix();
    }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      saveHandler();
    }
  });
  window.addEventListener("beforeunload", saveHandler);

  // Initial load
  loadMatrix();
  updateStatus();
}
