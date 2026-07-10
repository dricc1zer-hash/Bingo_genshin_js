const GRID_SIZE = 5;
const CELLS_COUNT = GRID_SIZE * GRID_SIZE;
const GRID_SIZE_CONQ = 7;
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
  // Bingo
  entries: [],
  activeColor: DEFAULT_PLAYER_COLOR,
  language: DEFAULT_LANGUAGE,
  gridTexts: [],
  gridLengths: [],
  gridColors: [],

  // Timer
  timerRunning: false,
  timerStart: null,
  timerElapsed: 0,
  timerId: null,

  // Mode
  mode: "bingo" // "bingo" | "conquete" | "route"
};

const els = {
  screens: [...document.querySelectorAll(".screen")],

  // Bingo
  grid: document.querySelector("#bingo-grid"),
  // timer output (Bingo)
  timer: document.querySelector("#timer"),

  // Aide Bingo
  helpBingoBtn: document.querySelector("#help-bingo"),
  helpDialog: document.querySelector("#help-bingo-dialog"),
  helpDialogContent: document.querySelector("#help-bingo-content"),
  helpDialogClose: document.querySelector("#help-bingo-close"),

  // timer output (Conquête)
  timerConq: document.querySelector("#timer-conquete"),


  fillGrid: document.querySelector("#fill-grid"),

  // Conquête
  conqGrid: document.querySelector("#conquete-grid"),
  fillConq: document.querySelector("#fill-grid-conquete"),

  startTimer: document.querySelector("#start-timer"),
  stopTimer: document.querySelector("#stop-timer"),

  // Settings
  difficulty: document.querySelector("#difficulty"),
  lengthMin: document.querySelector("#length-min"),
  lengthMax: document.querySelector("#length-max"),
  timeLimit: document.querySelector("#time-limit"),
  linePoints: document.querySelector("#line-points"),
  showLength: document.querySelector("#show-length"),
  resetSettings: document.querySelector("#reset-settings"),
  language: document.querySelector("#language"),

  // Seed modal (Bingo only)
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
};

function makeMatrix(size, value) {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => value)
  );
}

function isCornerStart(row, col) {
  // A1, A7, G1, G7 => (0,0),(0,6),(6,0),(6,6)
  return (row === 0 || row === GRID_SIZE_CONQ - 1) && (col === 0 || col === GRID_SIZE_CONQ - 1);
}

function neighbors4(r, c, size) {
  return [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ].filter(([rr, cc]) => rr >= 0 && cc >= 0 && rr < size && cc < size);
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

function parseConqueteMotif(content) {
  // Accept either 7 lines of 0/1 without separators.
  const lines = content
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  const grid = lines.slice(0, GRID_SIZE_CONQ).map(line =>
    line
      .replace(/\s+/g, "")
      .split("")
      .map(ch => (ch === "1" ? 1 : 0))
  );
  if (grid.length !== GRID_SIZE_CONQ || grid.some(r => r.length !== GRID_SIZE_CONQ)) {
    throw new Error("Motif conquête invalide : attendu 7x7 de 0/1");
  }
  return grid;
}

function showMessage(title, message) {
  els.dialogTitle.textContent = title;
  els.dialogMessage.textContent = message;
  if (typeof els.dialog.showModal === "function") els.dialog.showModal();
  else window.alert(title + "\n\n" + message);
}

function formatTime(seconds) {
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return [hours, minutes, secs].map(value => String(value).padStart(2, "0")).join(":");
}

function validateTimeLimit({ silent = false } = {}) {
  const value = els.timeLimit.value.trim();
  const minutes = Number.parseInt(value, 10);
  if (!value || !Number.isInteger(minutes) || minutes <= 0) {
    els.timeLimit.value = "30";
    if (!silent) showMessage("Paramètres", "Le temps limite doit être un nombre entier supérieur à 0.");
    return false;
  }
  return true;
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

function clearTimerInterval() {
  if (state.timerId !== null) window.clearTimeout(state.timerId);
  state.timerId = null;
}

function updateTimerDisplay() {
  const t = state.mode === "conquete" ? els.timerConq : els.timer;
  if (!t) return;
  t.textContent = "Chronomètre : " + formatTime(elapsedSeconds());
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

  if (state.mode === "conquete") showConqueteResultPopup();
  else showBingoResultPopup();

  updateSeedButtons();
}

function updateSeedButtons() {
  // Bingo seed modal only
  if (els.importSeedBtn) els.importSeedBtn.disabled = state.timerRunning;
  if (els.exportSeedBtn) els.exportSeedBtn.disabled = state.timerRunning;
}

function showBingoResultPopup() {
  const bonusPerLine = linePoints();
  const results = Object.entries(PLAYER_LABELS).map(([color, label]) => {
    const cells = countCellsForColor(color);
    const completeLines = countCompleteLinesForColor(color);
    const bonus = completeLines * bonusPerLine;
    const total = cells + bonus;
    return { color, label, cells, completeLines, bonus, total };
  });

  const maxScore = Math.max(...results.map(r => r.total));
  const winners = results.filter(r => r.total === maxScore);
  const winnerText = winners.length === 1
    ? `Gagnant : ${winners[0].label} !`
    : `Égalité entre : ${winners.map(w => w.label).join(" et ")} !`;

  const lines = results.map(({ label, cells, completeLines, bonus }) => {
    return "Joueur " + label + " : " + (cells + bonus) +
      " points\n  (" + cells + " cases + " + completeLines +
      " ligne(s)/col/diag × " + bonusPerLine + ")";
  });

  showMessage(winnerText, "Temps : " + formatTime(state.timerElapsed) + "\n\n" + lines.join("\n\n"));
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
    if (Array.from({ length: GRID_SIZE }, (_, col) => state.gridColors[row][col].has(color)).every(Boolean)) count += 1;
  }
  for (let col = 0; col < GRID_SIZE; col++) {
    if (Array.from({ length: GRID_SIZE }, (_, row) => state.gridColors[row][col].has(color)).every(Boolean)) count += 1;
  }
  if (Array.from({ length: GRID_SIZE }, (_, i) => state.gridColors[i][i].has(color)).every(Boolean)) count += 1;
  if (Array.from({ length: GRID_SIZE }, (_, i) => state.gridColors[i][GRID_SIZE - 1 - i].has(color)).every(Boolean)) count += 1;
  return count;
}

// -------------------- Bingo --------------------

function propositionColumn() {
  return els.difficulty.value === "Facile" ? "proposition_detaillee" : "proposition";
}

function makeBingoEmptyGrid() {
  state.gridTexts = makeMatrix(GRID_SIZE, "");
  state.gridLengths = makeMatrix(GRID_SIZE, 0);
  state.gridColors = makeMatrix(GRID_SIZE, null).map(row => row.map(() => new Set()));
}

function buildEmptyGrid() {
  makeBingoEmptyGrid();
  if (!els.grid) return;
  els.grid.innerHTML = "";
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell empty";
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.setAttribute("aria-label", "Case vide");

      const textEl = document.createElement("div");
      textEl.className = "cell-text";
      cell.append(textEl);

      const starsEl = document.createElement("div");
      starsEl.className = "cell-stars";
      cell.append(starsEl);

      cell.addEventListener("click", () => toggleBingoCell(row, col));
      els.grid.append(cell);
    }
  }
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
    const text = entry[column];
    state.gridTexts[row][col] = text;

    const lengthValue = Number.parseInt(entry.longueur, 10);
    state.gridLengths[row][col] = Number.isInteger(lengthValue) ? lengthValue : 0;

    drawBingoCell(row, col);
  });
}

function drawBingoCell(row, col) {
  const cell = cellBingoElement(row, col);
  const text = state.gridTexts[row][col];
  const colors = orderedCellColors(state.gridColors[row][col]);

  const textEl = cell.querySelector(".cell-text");
  const starsEl = cell.querySelector(".cell-stars");

  textEl.textContent = text;

  const show = els.showLength && els.showLength.value === "Oui";
  const len = state.gridLengths[row][col];

  if (show && text) {
    const safeCount = Number.isInteger(len) ? Math.max(0, len) : 0;
    starsEl.style.display = "block";
    starsEl.innerHTML = Array.from({ length: safeCount })
      .map(() => '<span class="star-text" aria-hidden="true">★</span>')
      .join("");
  } else {
    starsEl.style.display = "none";
    starsEl.innerHTML = "";
  }

  cell.classList.toggle("empty", !text);
  cell.classList.toggle("filled", Boolean(text));
  cell.style.background = colorBackground(colors);
  cell.setAttribute("aria-label", text || "Case vide");
}

function cellBingoElement(row, col) {
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

function toggleBingoCell(row, col) {
  if (!state.timerRunning) {
    showMessage("Chronomètre", "Le chronomètre doit être démarré");
    return;
  }
  if (!state.gridTexts[row][col]) return;

  const colors = state.gridColors[row][col];
  if (colors.has(state.activeColor)) colors.delete(state.activeColor);
  else colors.add(state.activeColor);
  drawBingoCell(row, col);
}

function resetBingoScreen() {
  state.mode = "bingo";
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

function updateColorButtons() {
  els.colorButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.color === state.activeColor);
  });
}

// -------------------- Conquête --------------------

const CONQ_START_POINTS = [
  [0, 0],
  [0, GRID_SIZE_CONQ - 1],
  [GRID_SIZE_CONQ - 1, 0],
  [GRID_SIZE_CONQ - 1, GRID_SIZE_CONQ - 1],
];

const conqDefault = {
  motif: null,
  isPlayable: null,
  owner: null,
  // for UI
};

const stateConq = { ...conqDefault };

function makeConqEmptyGrid() {
  stateConq.owner = makeMatrix(GRID_SIZE_CONQ, null);
}

// Grille Conquête 7x7 intégrée (remplace conquete.txt)
function buildConqueteFromCode() {
  // 1 = case jouable, 0 = case non utilisée (invisible)
  stateConq.motif = [
    [1,1,1,1,0,0,1],
    [0,1,1,1,1,1,1],
    [0,1,1,1,1,1,1],
    [1,1,1,1,1,1,1],
    [1,1,1,1,1,1,0],
    [1,1,1,1,1,1,0],
    [1,0,0,1,1,1,1],
  ];


  stateConq.isPlayable = makeMatrix(GRID_SIZE_CONQ, false);
  for (let r = 0; r < GRID_SIZE_CONQ; r++) {
    for (let c = 0; c < GRID_SIZE_CONQ; c++) {
      stateConq.isPlayable[r][c] = stateConq.motif[r][c] === 1;
    }
  }
}


function cellConqElement(row, col) {
  return els.conqGrid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

function conqCellBackground(ownerSet) {
  // For Conquête, each cell has exactly one owner or null.
  if (!ownerSet) return "white";
  return PLAYER_COLORS[ownerSet];
}

function drawConqueteCell(row, col) {
  const cell = cellConqElement(row, col);
  const owner = stateConq.owner[row][col];

  if (!stateConq.isPlayable[row][col]) {
    // Hide "0" cells visually: same background as page and no border/frame
    cell.classList.add("empty");
    cell.classList.remove("filled");
    cell.style.background = "rgba(255,255,255,.45)";
    cell.style.borderColor = "transparent";
    cell.style.boxShadow = "none";
    cell.classList.remove("conq-start-frame");
    cell.querySelector(".cell-text").textContent = "";
    return;
  }

  cell.style.boxShadow = "none";
  cell.style.borderColor = "#9e988e";

  cell.classList.toggle("empty", !owner);
  cell.classList.toggle("filled", Boolean(owner));

  // Texte (rendu Conquête)
  const text = (stateConq.texts && stateConq.texts[row] && stateConq.texts[row][col]) ? stateConq.texts[row][col] : "";
  cell.querySelector(".cell-text").textContent = text || "";


  // Frame only on corner start cells
  const isCorner = isCornerStart(row, col);
  cell.classList.toggle("conq-start-frame", isCorner);

  // Couleur du cadre (obligation de démarrer sur ces cases)
  if (isCorner) {
    const cornerColor = cornerOwnerColor(row, col);
    cell.dataset.conqCorner = cornerColor;
  } else {
    cell.dataset.conqCorner = "";
  }

  cell.style.background = conqCellBackground(owner);
}



function buildEmptyConqueteGrid() {
  makeConqEmptyGrid();
  if (!els.conqGrid) return;
  els.conqGrid.innerHTML = "";

  for (let row = 0; row < GRID_SIZE_CONQ; row++) {
    for (let col = 0; col < GRID_SIZE_CONQ; col++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell conq-cell";
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.setAttribute("aria-label", "Case conquête");

      const textEl = document.createElement("div");
      textEl.className = "cell-text";
      cell.append(textEl);

      const starsEl = document.createElement("div");
      starsEl.className = "cell-stars";
      cell.append(starsEl);
      starsEl.style.display = "none";

      cell.addEventListener("click", () => toggleConqCell(row, col));
      els.conqGrid.append(cell);
    }
  }

  // Draw initial
  for (let row = 0; row < GRID_SIZE_CONQ; row++) {
    for (let col = 0; col < GRID_SIZE_CONQ; col++) drawConqueteCell(row, col);
  }
}

function conqHasAdjacentOwner(row, col, color) {
  for (const [rr, cc] of neighbors4(row, col, GRID_SIZE_CONQ)) {
    if (stateConq.owner[rr][cc] === color) return true;
  }
  return false;
}

function cornerCellsByColor() {
  // A1 (0,0) = green ; A7 (0,6) = red ; G1 (6,0) = blue ; G7 (6,6) = yellow
  return {
    green: [0, 0],
    red: [0, GRID_SIZE_CONQ - 1],
    blue: [GRID_SIZE_CONQ - 1, 0],
    yellow: [GRID_SIZE_CONQ - 1, GRID_SIZE_CONQ - 1],
  };
}

function conqHasAnyCellForColor(color) {
  for (let r = 0; r < GRID_SIZE_CONQ; r++) {
    for (let c = 0; c < GRID_SIZE_CONQ; c++) {
      if (stateConq.owner[r][c] === color) return true;
    }
  }
  return false;
}

function toggleConqCell(row, col) {
  // Must respect: adjacency rule only when user tries to color.
  if (!state.timerRunning) return;
  if (!stateConq.isPlayable[row][col]) return;
  if (stateConq.owner[row][col]) return; // already taken

  // If this color doesn't own any cell yet, only the corner start cell is allowed.
  if (!conqHasAnyCellForColor(state.activeColor)) {
    const corner = cornerCellsByColor()[state.activeColor];
    if (!corner) return;
    const [cr, cc] = corner;
    if (row !== cr || col !== cc) return;
  } else {
    // Otherwise apply adjacency rule.
    if (!conqHasAdjacentOwner(row, col, state.activeColor)) return;
  }

  stateConq.owner[row][col] = state.activeColor;
  drawConqueteCell(row, col);
}

async function conqAutoStartFillBingoLike() {
  // Règle demandée:
  // - "Commencer" met le TEXTE des propositions dans les cellules.
  // - "Commencer" ne DOIT PAS colorer (pas d'owner) : l'utilisateur clique ensuite.

  makeConqEmptyGrid();

  const entries = state.entries || [];
  if (entries.length === 0) return;

  const column = propositionColumn();

  // Liste des cellules jouables (motif=1)
  let playableCells = [];
  for (let r = 0; r < GRID_SIZE_CONQ; r++) {
    for (let c = 0; c < GRID_SIZE_CONQ; c++) {
      if (stateConq.isPlayable[r][c]) playableCells.push([r, c]);
    }
  }

  // Règles d'égalité de proposition demandées :
  // - A1=A7=G1=G7
  // - A2=B7=F1=G6
  // (coordonnées en index 0-based: A*=col0, B*=col1, ...)
  const eqGroup1 = [
    [0, 0],
    [0, GRID_SIZE_CONQ - 1],
    [GRID_SIZE_CONQ - 1, 0],
    [GRID_SIZE_CONQ - 1, GRID_SIZE_CONQ - 1],
  ];

  const eqGroup2 = [
    [0, 1], // A2 => row 0 col 1
    [1, GRID_SIZE_CONQ - 1], // B7 => row 1 col 6
    [GRID_SIZE_CONQ - 2, 0], // F1 => row 5 col 0
    [GRID_SIZE_CONQ - 1, GRID_SIZE_CONQ - 2], // G6 => row 6 col 5
  ];


  // Tirages de propositions depuis la liste (aléatoire selon Langue)
  // On ne filtre pas par longueur car Conquête n'avait pas de critères dans l'UI.
  const selectedForTexts = shuffle(entries).map(e => e[column]);
  let textIdx = 0;

  function nextText() {
    if (textIdx >= selectedForTexts.length) {
      // boucle si jamais la liste est courte
      textIdx = 0;
    }
    return selectedForTexts[textIdx++];
  }

  // Assignation texte: on écrit directement dans le DOM via drawConqueteCell
  // => on stocke temporairement dans stateConq.owner? non. On doit avoir un champ texte.
  // On utilise un tableau dédié.
  if (!stateConq.texts) stateConq.texts = makeMatrix(GRID_SIZE_CONQ, "");

  // clear texts
  stateConq.texts = makeMatrix(GRID_SIZE_CONQ, "");

  // group1 text
  const text1 = nextText();
  for (const [r, c] of eqGroup1) {
    if (stateConq.isPlayable[r][c]) stateConq.texts[r][c] = text1;
  }

  // group2 text
  const text2 = nextText();
  for (const [r, c] of eqGroup2) {
    if (stateConq.isPlayable[r][c]) stateConq.texts[r][c] = text2;
  }

  // autres cellules jouables: texte aléatoire
  for (const [r, c] of playableCells) {
    if (stateConq.texts[r][c]) continue;
    stateConq.texts[r][c] = nextText();
  }

  // Dessin pour afficher le texte.
  for (const [r, c] of playableCells) {
    drawConqueteCell(r, c);
  }
}



function cornerOwnerColor(row, col) {
  // A1 (0,0) vert ; A7 (0,6) rouge ; G1 (6,0) bleu ; G7 (6,6) jaune
  if (row === 0 && col === 0) return "green";
  if (row === 0 && col === GRID_SIZE_CONQ - 1) return "red";
  if (row === GRID_SIZE_CONQ - 1 && col === 0) return "blue";
  if (row === GRID_SIZE_CONQ - 1 && col === GRID_SIZE_CONQ - 1) return "yellow";
  return DEFAULT_PLAYER_COLOR;
}

function randomOwnerColor() {
  return COLOR_ORDER[Math.floor(Math.random() * COLOR_ORDER.length)];
}



function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function resetConqueteScreen() {
  state.mode = "conquete";
  clearTimerInterval();
  state.timerRunning = false;
  state.timerStart = null;
  state.timerElapsed = 0;
  state.activeColor = DEFAULT_PLAYER_COLOR;

  buildEmptyConqueteGrid();
  updateColorButtons();
  updateTimerDisplay();
}

function fillConquete() {
  // called by "Commencer" button; timer still not running.
  // no messages, simply reset and pre-place the starting corner cells.
  conqAutoStartFillBingoLike();
  for (let row = 0; row < GRID_SIZE_CONQ; row++) {
    for (let col = 0; col < GRID_SIZE_CONQ; col++) drawConqueteCell(row, col);
  }
}

function countConqCellsByColor() {
  const counts = { green: 0, red: 0, blue: 0, yellow: 0 };
  for (let r = 0; r < GRID_SIZE_CONQ; r++) {
    for (let c = 0; c < GRID_SIZE_CONQ; c++) {
      const owner = stateConq.owner[r][c];
      if (owner) counts[owner] += 1;
    }
  }
  return counts;
}

function showConqueteResultPopup() {
  const counts = countConqCellsByColor();
  const results = Object.entries(PLAYER_LABELS).map(([color, label]) => ({
    color,
    label,
    total: counts[color] || 0,
  }));

  const maxScore = Math.max(...results.map(r => r.total));
  const winners = results.filter(r => r.total === maxScore);
  const winnerText = winners.length === 1
    ? `Gagnant : ${winners[0].label} !`
    : `Égalité entre : ${winners.map(w => w.label).join(" et ")} !`;

  const lines = results.map(r => `Joueur ${r.label} : ${r.total} cases`);
  showMessage(winnerText, "Temps : " + formatTime(state.timerElapsed) + "\n\n" + lines.join("\n\n"));
}

// -------------------- Navigation / Bootstrap --------------------

function showScreen(screenId) {
  validateTimeLimit({ silent: true });
  // Only validate bingo settings; conquête uses only timeLimit.

  els.screens.forEach(screen => screen.classList.toggle("screen-active", screen.id === screenId));

  if (screenId === "bingo-screen") resetBingoScreen();
  if (screenId === "conquete-screen") resetConqueteScreen();
  if (screenId === "route-screen" && typeof resetRouteScreen === "function") resetRouteScreen();
}

function updateLanguageAndLoad() {
  // Keep original behavior for bingo language.
}

async function bootstrap() {
  // Load and wire Bingo help (async file load)
  if (els.helpBingoBtn && els.helpBingoDialog && els.helpDialogContent && els.helpBingoClose) {
    els.helpDialogContent.textContent = "Chargement...";
    els.helpBingoBtn.addEventListener("click", async () => {
      try {
      const txt = await loadTextFile("HELP_bingo.txt.txt").catch(() => loadTextFile("HELP_bingo.txt"));
        // Support legacy filenames (if any)
        // (No-op; just ensures catch chain is stable)
        els.helpDialogContent.textContent = txt;
        els.helpDialog.showModal();
      } catch (e) {
        els.helpDialogContent.textContent = "Aide indisponible: " + (e?.message || String(e));
        els.helpDialog.showModal();
      }
    });
    els.helpBingoClose.addEventListener("click", () => {
      try { els.helpDialog.close(); } catch (_) {}
    });
  }
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

  // Build Conquête grid motif in code (no file dependency)
  try {
    buildConqueteFromCode();
  } catch (e) {
    console.error(e);
  }


  buildEmptyGrid();
  updateColorButtons();
  updateTimerDisplay();

  // Bingo seed UI only
  if (els.fillGrid) els.fillGrid.disabled = false;
  if (els.fillConq) els.fillConq.disabled = false;

  if (els.conqGrid && stateConq.isPlayable) {
    buildEmptyConqueteGrid();
  }

  if (typeof initRouteModule === "function") initRouteModule();
}

// -------------------- Seed modal (Bingo only) --------------------

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
  state.gridColors = makeMatrix(GRID_SIZE, null).map(row => row.map(() => new Set()));
  let entryIndex = 0;
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const char1 = seed[entryIndex];
      const char2 = seed[entryIndex + 1];
      entryIndex += 2;
      if (char1 === " " || char2 === " ") {
        state.gridTexts[row][col] = "";
        drawBingoCell(row, col);
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
      drawBingoCell(row, col);
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

// -------------------- Event wiring --------------------

document.addEventListener("click", event => {
  const screenButton = event.target.closest("[data-screen]");
  if (screenButton) showScreen(screenButton.dataset.screen);
});

if (els.colorButtons) {
  els.colorButtons.forEach(button => {
    button.addEventListener("click", () => {
      state.activeColor = button.dataset.color;
      updateColorButtons();
          console.debug("[color] change", { mode: state.mode, timerRunning: state.timerRunning });
    });
  });
}

if (els.fillGrid) els.fillGrid.addEventListener("click", fillGrid);
if (els.fillConq) els.fillConq.addEventListener("click", () => {
  // no action during timer? allow reset anytime
  if (!stateConq.isPlayable) return;
  fillConquete();
});

// Timer wiring via event delegation (robust even if DOM timing/caching differs)
document.addEventListener("click", event => {
  const startBtn = event.target.closest && event.target.closest("#start-timer");
  if (startBtn) {
    console.debug("[timer] start click", { mode: state.mode, timerRunning: state.timerRunning });
    startTimer();
    return;
  }

  const stopBtn = event.target.closest && event.target.closest("#stop-timer");
  if (stopBtn) {
    console.debug("[timer] stop click", { mode: state.mode, timerRunning: state.timerRunning });
    stopTimer();
    return;
  }
});



if (els.resetSettings) els.resetSettings.addEventListener("click", () => {
  // Bingo settings defaults only
  els.language.value = DEFAULT_LANGUAGE;
  els.difficulty.value = "Normal";
  els.lengthMin.value = "1";
  els.lengthMax.value = "5";
  els.timeLimit.value = "30";
  els.linePoints.value = "3";
  if (els.showLength) els.showLength.value = "Non";
  loadLanguage();

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (state.gridTexts[row] && state.gridTexts[row][col]) drawBingoCell(row, col);
    }
  }
});

if (els.language) els.language.addEventListener("change", loadLanguage);
if (els.timeLimit) els.timeLimit.addEventListener("blur", () => validateTimeLimit({ silent: true }));
if (els.linePoints) els.linePoints.addEventListener("blur", () => validateLinePoints({ silent: true }));
if (els.showLength) els.showLength.addEventListener("change", () => {
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (state.gridTexts[row] && state.gridTexts[row][col]) drawBingoCell(row, col);
    }
  }
});

if (els.importSeedBtn) els.importSeedBtn.addEventListener("click", importSeed);
if (els.exportSeedBtn) els.exportSeedBtn.addEventListener("click", exportSeed);
if (els.confirmSeedBtn) els.confirmSeedBtn.addEventListener("click", confirmImport);
if (els.cancelSeedBtn) els.cancelSeedBtn.addEventListener("click", cancelImport);
if (els.pasteSeedBtn) els.pasteSeedBtn.addEventListener("click", pasteFromClipboard);
if (els.copySeedBtn) els.copySeedBtn.addEventListener("click", copyToClipboard);
if (document.getElementById("close-seed")) document.getElementById("close-seed").addEventListener("click", closeSeedDialog);

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

bootstrap();

