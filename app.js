const GRID_SIZE = 5;
const CELLS_COUNT = GRID_SIZE * GRID_SIZE;
const PLAYER_COLORS = { green: "#2ecc71", red: "#e74c3c", blue: "#3498db", yellow: "#f1c40f" };
const PLAYER_LABELS = { green: "Vert", red: "Rouge", blue: "Bleu", yellow: "Jaune" };
const COLOR_ORDER = ["green", "red", "blue", "yellow"];
const DEFAULT_PLAYER_COLOR = "green";
const LANGUAGES = {
  "FR": "Liste_FR.txt",
  "EN": "Liste_EN.txt",
};
const DEFAULT_LANGUAGE = "FR";

const SEED_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$&";

const state = {
  entries: [],
  activeColor: DEFAULT_PLAYER_COLOR,
  language: DEFAULT_LANGUAGE,
  gridTexts: [],
  gridColors: [],
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
  importSeedBtn: document.querySelector("#import-seed"),
  exportSeedBtn: document.querySelector("#export-seed"),
  seedInput: document.querySelector("#seed-input"),
  seedDialog: document.querySelector("#seed-dialog"),
  seedDisplay: document.querySelector("#seed-display"),
  confirmSeedBtn: document.querySelector("#confirm-seed"),
  cancelSeedBtn: document.querySelector("#cancel-seed"),
  pasteSeedBtn: document.querySelector("#paste-seed"),
  copySeedBtn: document.querySelector("#copy-seed"),
  helpBtn: document.querySelector("#help-btn"),
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
    const selectedLang = els.language.value || DEFAULT_LANGUAGE;
    const listFileName = LANGUAGES[selectedLang];
    const data = await Promise.all([
      loadTextFile(listFileName),
      loadTextFile("Crédits.txt").catch(() => ""),
    ]);
    state.entries = parseListFile(data[0]);
    els.credits.textContent = data[1];
    state.language = selectedLang;
  } catch (error) {
    showMessage("Erreur", "Impossible de charger les données du jeu.\n" + error.message);
  }
  buildEmptyGrid();
  updateColorButtons();
  updateTimerDisplay();
  updateSeedButtons();
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
  updateSeedButtons();
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

function updateSeedButtons() {
  els.importSeedBtn.disabled = state.timerRunning;
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
      "Pas assez de propositions pour les critères choisis (longueur " +
        els.lengthMin.value +
        " à " +
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
    showMessage("Chronomètre", "Le chronomètre doit être démarré");
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
      showMessage("Paramètres", "Le temps limite doit être un nombre entier supérieur à 0.");
    return false;
  }
  return true;
}

function validateLinePoints({ silent = false } = {}) {
  const value = els.linePoints.value.trim();
  const points = Number.parseInt(value, 10);
  if (!value || !Number.isInteger(points)) {
    els.linePoints.value = "3";
    if (!silent) showMessage("Paramètres", "Le nombre de points doit être un nombre entier.");
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
  updateSeedButtons();
}

function stopTimer() {
  if (!state.timerRunning) {
    showMessage("Chronomètre", "Le chronomètre n'est pas démarré.");
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
  updateSeedButtons();
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
  els.timer.textContent = "Chronomètre : " + formatTime(elapsedSeconds());
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
  const results = Object.entries(PLAYER_LABELS)
    .map(([color, label]) => {
      const cells = countCellsForColor(color);
      const completeLines = countCompleteLinesForColor(color);
      const bonus = completeLines * bonusPerLine;
      const total = cells + bonus;
      return {
        color,
        label,
        cells,
        completeLines,
        bonus,
        total
      };
    });

  const maxScore = Math.max(...results.map(r => r.total));
  const winners = results.filter(r => r.total === maxScore);
  const winnerText = winners.length === 1 
    ? `Gagnant : ${winners[0].label} !` 
    : `Égalité entre : ${winners.map(w => w.label).join(" et ")} !`;

  const lines = results
    .map(({ label, cells, completeLines, bonus, total }) => {
      return (
        "Joueur " +
        label +
        " : " +
        total +
        " points\n  (" +
        cells +
        " cases + " +
        completeLines +
        " ligne(s)/col/diag × " +
        bonusPerLine +
        ")"
      );
    });
  
  showMessage(winnerText, "Temps : " + formatTime(state.timerElapsed) + "\n\n" + lines.join("\n\n"));
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
  loadLanguage();
}

async function showHelp() {
  try {
    const helpText = await loadTextFile("HELP_bingo.txt");
    showMessage("Aide", helpText);
  } catch (error) {
    showMessage("Erreur", "Impossible de charger le fichier d'aide.\n" + error.message);
  }
}

async function loadLanguage() {
  try {
    const selectedLang = els.language.value;
    const listFileName = LANGUAGES[selectedLang];
    const content = await loadTextFile(listFileName);
    state.entries = parseListFile(content);
  } catch (error) {
    showMessage("Erreur", "Impossible de charger la langue sélectionnée.\n" + error.message);
    els.language.value = DEFAULT_LANGUAGE;
  }
}

function encodeSeed() {
  let seed = "";
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const text = state.gridTexts[row][col];
      if (!text) {
        seed += "  ";
        continue;
      }
      const entryIndex = state.entries.findIndex(e => e.proposition === text || e.proposition_detaillee === text);
      if (entryIndex === -1) {
        seed += "  ";
        continue;
      }
      let index = entryIndex;
      let encoded = "";
      for (let i = 0; i < 2; i++) {
        encoded = encoded + SEED_ALPHABET[index % 64];
        index = Math.floor(index / 64);
      }
      seed += encoded;
    }
  }
  return seed;
}

function decodeSeed(seed) {
  if (seed.length !== 50) {
    showMessage("Erreur", "La graine doit contenir exactement 50 caractères.");
    return false;
  }
  state.gridColors = makeMatrix(null).map(row => row.map(() => new Set()));
  let entryIndex = 0;
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const char1 = seed[entryIndex];
      const char2 = seed[entryIndex + 1];
      entryIndex += 2;
      if (char1 === " " || char2 === " ") {
        state.gridTexts[row][col] = "";
        drawCell(row, col);
        continue;
      }
      const idx1 = SEED_ALPHABET.indexOf(char1);
      const idx2 = SEED_ALPHABET.indexOf(char2);
      if (idx1 === -1 || idx2 === -1) {
        showMessage("Erreur", "Caractère invalide dans la graine : " + (idx1 === -1 ? char1 : char2));
        return false;
      }
      const index = idx2 * 64 + idx1;
      if (index < 0 || index >= state.entries.length) {
        showMessage("Erreur", "Index invalide dans la graine : " + index);
        return false;
      }
      const entry = state.entries[index];
      const column = propositionColumn();
      state.gridTexts[row][col] = entry[column];
      drawCell(row, col);
    }
  }
  return true;
}

function exportSeed() {
  const seed = encodeSeed();
  els.seedDisplay.textContent = seed;
  document.getElementById("export-section").style.display = "block";
  document.getElementById("import-section").style.display = "none";
  els.seedDialog.showModal();
}

function closeSeedDialog() {
  els.seedDialog.close();
}

function importSeed() {
  if (state.timerRunning) {
    showMessage("Erreur", "Impossible d'importer une graine pendant que le chronomètre est en cours.");
    return;
  }
  els.seedInput.value = "";
  document.getElementById("export-section").style.display = "none";
  document.getElementById("import-section").style.display = "block";
  els.seedDialog.showModal();
}

function confirmImport() {
  const seed = els.seedInput.value.trim();
  if (!seed) {
    showMessage("Erreur", "Veuillez saisir une graine.");
    return;
  }
  if (seed.length !== 50) {
    showMessage("Erreur", "La graine doit contenir exactement 50 caractères.");
    return;
  }
  const success = decodeSeed(seed);
  if (success) {
    els.seedDialog.close();
    els.seedInput.value = "";
  }
}

function cancelImport() {
  els.seedDialog.close();
  els.seedInput.value = "";
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    els.seedInput.value = text;
  } catch (err) {
    showMessage("Erreur", "Impossible d'accéder au presse-papier.");
  }
}

async function copyToClipboard() {
  try {
    const seed = els.seedDisplay.textContent;
    await navigator.clipboard.writeText(seed);
    showMessage("Succès", "Graine copiée dans le presse-papier !");
  } catch (err) {
    showMessage("Erreur", "Impossible de copier dans le presse-papier.");
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
els.importSeedBtn.addEventListener("click", importSeed);
els.exportSeedBtn.addEventListener("click", exportSeed);
els.confirmSeedBtn.addEventListener("click", confirmImport);
els.cancelSeedBtn.addEventListener("click", cancelImport);
els.pasteSeedBtn.addEventListener("click", pasteFromClipboard);
els.copySeedBtn.addEventListener("click", copyToClipboard);
document.getElementById("close-seed").addEventListener("click", closeSeedDialog);
els.helpBtn.addEventListener("click", showHelp);

bootstrap();
