const GRID_SIZE = 5;
const CELLS_COUNT = GRID_SIZE * GRID_SIZE;
const PLAYER_COLORS = { green: "#2ecc71", red: "#e74c3c", blue: "#3498db", yellow: "#f1c40f" };
const PLAYER_LABELS = { green: "Vert", red: "Rouge", blue: "Bleu", yellow: "Jaune" };
const COLOR_ORDER = ["green", "red", "blue", "yellow"];
const DEFAULT_PLAYER_COLOR = "green";
const LANGUAGES = {
  "FranÃ§ais/French": "Liste_FR.txt",
  "English": "Liste_EN.txt",
};
const DEFAULT_LANGUAGE = "FranÃ§ais/French";

const state = {
  entries: [],
  activeColor: DEFAULT_PLAYER_COLOR,
  language: DEFAULT_LANGUAGE,
  gridTexts: makeMatrix(""),
  gridColors: makeMatrix(null).map(row => row.map(() => new Set())),
  timerRunning: false,
  timerStart: null,
  timerElapsed: 0,
  timerId: null,
};

const els = {
  screens: [...document.querySelectorAll(".screen")],
  grid: document.querySelector("#bingo-grid"),
  timer: document.querySelector("#timer"),
  fillGrid: document.querySelector("#fill-grid"),
  startTimer: document.querySelector("#start-timer"),
  stopTimer: document.querySelector("#stop-timer"),
  difficulty: document.querySelector("#difficulty"),
  lengthMin: document.querySelector("#length-min"),
  lengthMax: document.querySelector("#length-max"),
  timeLimit: document.querySelector("#time-limit"),
  linePoints: document.querySelector("#line-points"),
  resetSettings: document.querySelector("#reset-settings"),
  language: document.querySelector("#language"),
  colorButtons: [...document.querySelectorAll(".color-button")],
  credits: document.querySelector("#credits-content"),
  dialog: document.querySelector("#message-dialog"),
  dialogTitle: document.querySelector("#dialog-title"),
  dialogMessage: document.querySelector("#dialog-message"),
};

function makeMatrix(value) {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => value)
  );
}

async function loadTextFile(fileName) {
  const response = await fetch(fileName);
  if (!response.ok) throw new Error(fileName + " introuvable");
  return response.text();
}

function parseListFile(content) {
  return content
    .split(/\r?\n/)
    .map(line => line.split("\t"))
    .filter(parts => parts.length >= 5)
    .map(parts => ({
      type: parts[0].trim(),
      proposition: parts[1].trim(),
      longueur: parts[2].trim(),
      region: parts[3].trim(),
      proposition_detaillee: parts[4].trim(),
    }));
}

async function bootstrap() {
  try {
    const listFileName = LANGUAGES[DEFAULT_LANGUAGE];
    const data = await Promise.all([
      loadTextFile(listFileName),
      loadTextFile("CrÃ©dits.txt").catch(() => ""),
    ]);
    state.entries = parseListFile(data[0]);
    els.credits.textContent = data[1];
  } catch (error) {
    showMessage("Erreur", "Impossible de charger les donnÃ©es du jeu.\n" + error.message);
  }
  buildEmptyGrid();
  updateColorButtons();
  updateTimerDisplay();
}

function showScreen(screenId) {
  validateTimeLimit({ silent: true });
  validateLinePoints({ silent: true });
  els.screens.forEach(screen =>
    screen.classList.toggle("screen-active", screen.id === screenId)
  );
  if (screenId === "bingo-screen") resetBingoScreen();
}

function resetBingoScreen() {
  clearTimerInterval();
  state.timerRunning = false;
  state.timerStart = null;
  state.timerElapsed = 0;
  state.activeColor = DEFAULT_PLAYER_COLOR;
  buildEmptyGrid();
  updateColorButtons();
  updateTimerDisplay();
}

function buildEmptyGrid() {
  state.gridTexts = makeMatrix("");
  state.gridColors = makeMatrix(null).map(row => row.map(() => new Set()));
  els.grid.innerHTML = "";
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell empty";
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.setAttribute("aria-label", "Case vide");
      cell.addEventListener("click", () => toggleCell(row, col));
      els.grid.append(cell);
    }
  }
}

function updateColorButtons() {
  els.colorButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.color === state.activeColor);
  });
}

function propositionColumn() {
  return els.difficulty.value === "Facile" ? "proposition_detaillee" : "proposition";
}

function filteredEntries() {
  const min = Number.parseInt(els.lengthMin.value, 10);
  const max = Number.parseInt(els.lengthMax.value, 10);
  return state.entries.filter(entry => {
    const length = Number.parseInt(entry.longueur, 10);
    return Number.isInteger(length) && length >= min && length <= max;
  });
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function fillGrid() {
  const entries = filteredEntries();
  if (entries.length < CELLS_COUNT) {
    showMessage(
      "Erreur",
      "Pas assez de propositions pour les critÃ¨res choisis (longueur " +
        els.lengthMin.value +
        " Ã  " +
        els.lengthMax.value +
        ").\nIl en faut au moins " +
        CELLS_COUNT +
        ", actuellement " +
        entries.length +
        "."
    );
    return;
  }
  const selected = shuffle(entries).slice(0, CELLS_COUNT);
  const column = propositionColumn();
  buildEmptyGrid();
  selected.forEach((entry, index) => {
    const row = Math.floor(index / GRID_SIZE);
    const col = index % GRID_SIZE;
    state.gridTexts[row][col] = entry[column];
    drawCell(row, col);
  });
}

function drawCell(row, col) {
  const cell = cellElement(row, col);
  const text = state.gridTexts[row][col];
  const colors = orderedCellColors(state.gridColors[row][col]);
  cell.textContent = text;
  cell.classList.toggle("empty", !text);
  cell.classList.toggle("filled", Boolean(text));
  cell.style.background = colorBackground(colors);
  cell.setAttribute("aria-label", text || "Case vide");
}

function cellElement(row, col) {
  return els.grid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

function orderedCellColors(colors) {
  return COLOR_ORDER.filter(color => colors.has(color));
}

function colorBackground(colors) {
  if (colors.length === 0) return "white";
  if (colors.length === 1) return PLAYER_COLORS[colors[0]];
  if (colors.length === 2) {
    return (
      "linear-gradient(135deg, " +
      PLAYER_COLORS[colors[0]] +
      " 0 50%, " +
      PLAYER_COLORS[colors[1]] +
      " 50% 100%)"
    );
  }
  if (colors.length === 3) {
    return (
      "conic-gradient(from 315deg, " +
      PLAYER_COLORS[colors[0]] +
      " 0 33.33%, " +
      PLAYER_COLORS[colors[1]] +
      " 33.33% 66.66%, " +
      PLAYER_COLORS[colors[2]] +
      " 66.66% 100%)"
    );
  }
  return (
    "conic-gradient(from 315deg, " +
    PLAYER_COLORS[colors[0]] +
    " 0 25%, " +
    PLAYER_COLORS[colors[1]] +
    " 25% 50%, " +
    PLAYER_COLORS[colors[2]] +
    " 50% 75%, " +
    PLAYER_COLORS[colors[3]] +
    " 75% 100%)"
  );
}

function toggleCell(row, col) {
  if (!state.timerRunning) {
    showMessage("ChronomÃ¨tre", "Le chronomÃ¨tre doit Ãªtre dÃ©marrÃ©");
    return;
  }
  if (!state.gridTexts[row][col]) return;

  const colors = state.gridColors[row][col];
  if (colors.has(state.activeColor)) colors.delete(state.activeColor);
  else colors.add(state.activeColor);
  drawCell(row, col);
}

function elapsedSeconds() {
  if (state.timerRunning && state.timerStart !== null)
    return state.timerElapsed + (performance.now() - state.timerStart) / 1000;
  return state.timerElapsed;
}

function timeLimitSeconds() {
  const minutes = Number.parseInt(els.timeLimit.value.trim(), 10);
  if (!Number.isInteger(minutes) || minutes <= 0) return null;
  return minutes * 60;
}

function validateTimeLimit({ silent = false } = {}) {
  const value = els.timeLimit.value.trim();
  const minutes = Number.parseInt(value, 10);
  if (!value || !Number.isInteger(minutes) || minutes <= 0) {
    els.timeLimit.value = "30";
    if (!silent)
      showMessage("ParamÃ¨tres", "Le temps limite doit Ãªtre un nombre entier supÃ©rieur Ã  0.");
    return false;
  }
  return true;
}

function validateLinePoints({ silent = false } = {}) {
  const value = els.linePoints.value.trim();
  const points = Number.parseInt(value, 10);
  if (!value || !Number.isInteger(points)) {
    els.linePoints.value = "3";
    if (!silent) showMessage("ParamÃ¨tres", "Le nombre de points doit Ãªtre un nombre entier.");
    return false;
  }
  return true;
}

function linePoints() {
  validateLinePoints({ silent: true });
  return Number.parseInt(els.linePoints.value, 10);
}

function startTimer() {
  if (state.timerRunning) return;
  if (!validateTimeLimit()) return;
  state.timerRunning = true;
  state.timerStart = performance.now();
  tickTimer();
}

function stopTimer() {
  if (!state.timerRunning) {
    showMessage("ChronomÃ¨tre", "Le chronomÃ¨tre n'est pas dÃ©marrÃ©.");
    return;
  }
  finalizeTimer();
}

function finalizeTimer({ capAtLimit = false } = {}) {
  if (state.timerStart !== null) state.timerElapsed += (performance.now() - state.timerStart) / 1000;
  if (capAtLimit) {
    const limit = timeLimitSeconds();
    if (limit !== null) state.timerElapsed = Math.min(state.timerElapsed, limit);
  }
  state.timerRunning = false;
  state.timerStart = null;
  clearTimerInterval();
  updateTimerDisplay();
  showResultPopup();
}

function clearTimerInterval() {
  if (state.timerId !== null) window.clearTimeout(state.timerId);
  state.timerId = null;
}

function tickTimer() {
  updateTimerDisplay();
  if (!state.timerRunning) return;
  const limit = timeLimitSeconds();
  if (limit !== null && elapsedSeconds() >= limit) {
    finalizeTimer({ capAtLimit: true });
    return;
  }
  state.timerId = window.setTimeout(tickTimer, 100);
}

function updateTimerDisplay() {
  els.timer.textContent = "ChronomÃ¨tre : " + formatTime(elapsedSeconds());
}

function formatTime(seconds) {
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return [hours, minutes, secs].map(value => String(value).padStart(2, "0")).join(":");
}

function countCellsForColor(color) {
  let count = 0;
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (state.gridColors[row][col].has(color)) count += 1;
    }
  }
  return count;
}

function countCompleteLinesForColor(color) {
  let count = 0;
  for (let row = 0; row < GRID_SIZE; row++) {
    if (
      Array.from({ length: GRID_SIZE }, (_, col) =>
        state.gridColors[row][col].has(color)
      ).every(Boolean)
    )
      count += 1;
  }
  for (let col = 0; col < GRID_SIZE; col++) {
    if (
      Array.from({ length: GRID_SIZE }, (_, row) =>
        state.gridColors[row][col].has(color)
      ).every(Boolean)
    )
      count += 1;
  }
  if (
    Array.from({ length: GRID_SIZE }, (_, i) => state.gridColors[i][i].has(color)).every(
      Boolean
    )
  )
    count += 1;
  if (
    Array.from({ length: GRID_SIZE }, (_, i) =>
      state.gridColors[i][GRID_SIZE - 1 - i].has(color)
    ).every(Boolean)
  )
    count += 1;
  return count;
}

function showResultPopup() {
  const bonusPerLine = linePoints();
  const lines = Object.entries(PLAYER_LABELS)
    .map(([color, label]) => {
      const cells = countCellsForColor(color);
      const completeLines = countCompleteLinesForColor(color);
      const bonus = completeLines * bonusPerLine;
      return (
        "Joueur " +
        label +
        " : " +
        (cells + bonus) +
        " points\n  (" +
        cells +
        " cases + " +
        completeLines +
        " ligne(s)/col/diag Ã— " +
        bonusPerLine +
        ")"
      );
    });
  showMessage("RÃ©sultat", "Temps : " + formatTime(state.timerElapsed) + "\n\n" + lines.join("\n\n"));
}

function showMessage(title, message) {
  els.dialogTitle.textContent = title;
  els.dialogMessage.textContent = message;
  if (typeof els.dialog.showModal === "function") els.dialog.showModal();
  else window.alert(title + "\n\n" + message);
}

function resetSettingsToDefaults() {
  els.language.value = DEFAULT_LANGUAGE;
  els.difficulty.value = "Normal";
  els.lengthMin.value = "1";
  els.lengthMax.value = "5";
  els.timeLimit.value = "30";
  els.linePoints.value = "3";
}

async function loadLanguage() {
  try {
    const listFileName = LANGUAGES[els.language.value];
    const content = await loadTextFile(listFileName);
    state.entries = parseListFile(content);
  } catch (error) {
    showMessage("Erreur", "Impossible de charger la langue sÃ©lectionnÃ©e.\n" + error.message);
    els.language.value = DEFAULT_LANGUAGE;
  }
}

document.addEventListener("click", event => {
  const screenButton = event.target.closest("[data-screen]");
  if (screenButton) showScreen(screenButton.dataset.screen);
});

els.colorButtons.forEach(button => {
  button.addEventListener("click", () => {
    state.activeColor = button.dataset.color;
    updateColorButtons();
  });
});

els.fillGrid.addEventListener("click", fillGrid);
els.startTimer.addEventListener("click", startTimer);
els.stopTimer.addEventListener("click", stopTimer);
els.resetSettings.addEventListener("click", resetSettingsToDefaults);
els.language.addEventListener("change", loadLanguage);
els.timeLimit.addEventListener("blur", () => validateTimeLimit({ silent: true }));
els.linePoints.addEventListener("blur", () => validateLinePoints({ silent: true }));

bootstrap();