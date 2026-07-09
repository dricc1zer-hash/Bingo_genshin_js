const ROUTE_CELL_COUNT = 18;
const ROUTE_PAWN_IMAGES = {
  green: "Pion_Vert.png",
  red: "Pion_Rouge.png",
  blue: "Pion_Bleu.png",
  yellow: "Pion_Jaune.png",
};

const stateRoute = {
  texts: {},
  pawnPositions: { green: "start", red: "start", blue: "start", yellow: "start" },
  started: false,
  gameOver: false,
  winner: null,
};

function routeCellId(section, col, row) {
  return section + "-" + col + "-" + row;
}

function buildRouteMoves() {
  const moves = {};

  moves.start = {
    up: routeCellId("t", 0, 0),
    straight: routeCellId("t", 0, 1),
    down: routeCellId("t", 0, 2),
  };

  function addColumnMoves(section, fromCol, toCol) {
    for (let row = 0; row < 3; row++) {
      const from = routeCellId(section, fromCol, row);
      const nodeMoves = {};
      if (row === 0) {
        nodeMoves.straight = routeCellId(section, toCol, 0);
        nodeMoves.down = routeCellId(section, toCol, 1);
      } else if (row === 1) {
        nodeMoves.up = routeCellId(section, toCol, 0);
        nodeMoves.straight = routeCellId(section, toCol, 1);
        nodeMoves.down = routeCellId(section, toCol, 2);
      } else {
        nodeMoves.up = routeCellId(section, toCol, 1);
        nodeMoves.straight = routeCellId(section, toCol, 2);
      }
      moves[from] = nodeMoves;
    }
  }

  addColumnMoves("t", 0, 1);
  addColumnMoves("t", 1, 2);

  moves[routeCellId("t", 2, 0)] = { down: routeCellId("b", 2, 2) };
  moves[routeCellId("t", 2, 1)] = { straight: routeCellId("b", 2, 1) };
  moves[routeCellId("t", 2, 2)] = { up: routeCellId("b", 2, 0) };

  addColumnMoves("b", 2, 1);
  addColumnMoves("b", 1, 0);

  for (let row = 0; row < 3; row++) {
    moves[routeCellId("b", 0, row)] = { straight: "finish" };
  }

  return moves;
}

const ROUTE_MOVES = buildRouteMoves();

const ROUTE_ARROW_EDGES = (function () {
  const edges = [];
  function push(from, to) {
    if (from && to) edges.push([from, to]);
  }

  push("start", routeCellId("t", 0, 0));
  push("start", routeCellId("t", 0, 1));
  push("start", routeCellId("t", 0, 2));

  function addColumnEdges(section, fromCol, toCol) {
    for (let row = 0; row < 3; row++) {
      const from = routeCellId(section, fromCol, row);
      if (row === 0) {
        push(from, routeCellId(section, toCol, 0));
        push(from, routeCellId(section, toCol, 1));
      } else if (row === 1) {
        push(from, routeCellId(section, toCol, 0));
        push(from, routeCellId(section, toCol, 1));
        push(from, routeCellId(section, toCol, 2));
      } else {
        push(from, routeCellId(section, toCol, 1));
        push(from, routeCellId(section, toCol, 2));
      }
    }
  }

  addColumnEdges("t", 0, 1);
  addColumnEdges("t", 1, 2);
  push(routeCellId("t", 2, 0), routeCellId("b", 2, 2));
  push(routeCellId("t", 2, 1), routeCellId("b", 2, 1));
  push(routeCellId("t", 2, 2), routeCellId("b", 2, 0));
  addColumnEdges("b", 2, 1);
  addColumnEdges("b", 1, 0);

  for (let row = 0; row < 3; row++) {
    push(routeCellId("b", 0, row), "finish");
  }

  return edges;
})();

const routeEls = {
  board: null,
  arrowsSvg: null,
  fillBtn: null,
  controls: null,
};

function routeAllNodeIds() {
  const ids = ["start", "finish"];
  for (const section of ["t", "b"]) {
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 3; row++) ids.push(routeCellId(section, col, row));
    }
  }
  return ids;
}

function routeZoneLabel(text) {
  const span = document.createElement("span");
  span.className = "route-zone-label";
  span.textContent = text;
  return span;
}

function routeStartPawnLayers() {
  const stack = document.createElement("div");
  stack.className = "route-start-stack";

  const topCol = document.createElement("div");
  topCol.className = "route-pawns-top-col";

  const bottomCol = document.createElement("div");
  bottomCol.className = "route-pawns-bottom-col";

  stack.append(topCol);
  stack.append(routeZoneLabel("Départ"));
  stack.append(bottomCol);
  return stack;
}

function buildRouteBoard() {
  const board = routeEls.board;
  if (!board) return;
  board.innerHTML = "";

  const start = document.createElement("div");
  start.className = "route-zone route-zone-start";
  start.dataset.node = "start";
  start.append(routeStartPawnLayers());
  board.append(start);

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cell = document.createElement("div");
      cell.className = "route-cell";
      cell.dataset.node = routeCellId("t", col, row);
      cell.style.gridColumn = String(col + 2);
      cell.style.gridRow = String(row + 1);
      const text = document.createElement("div");
      text.className = "route-cell-text";
      cell.append(text);
      cell.append(routePawnsLayer());
      board.append(cell);
    }
  }

  const gap = document.createElement("div");
  gap.style.gridColumn = "1 / -1";
  gap.style.gridRow = "4";
  gap.setAttribute("aria-hidden", "true");
  board.append(gap);

  const finish = document.createElement("div");
  finish.className = "route-zone route-zone-finish";
  finish.dataset.node = "finish";
  finish.append(routeZoneLabel("Arrivée"));
  finish.append(routePawnsLayer());
  board.append(finish);

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cell = document.createElement("div");
      cell.className = "route-cell";
      cell.dataset.node = routeCellId("b", col, row);
      cell.style.gridColumn = String(col + 2);
      cell.style.gridRow = String(row + 5);
      const text = document.createElement("div");
      text.className = "route-cell-text";
      cell.append(text);
      cell.append(routePawnsLayer());
      board.append(cell);
    }
  }
}

function routePawnsLayer() {
  const layer = document.createElement("div");
  layer.className = "route-pawns";
  return layer;
}

function buildRouteControls() {
  const container = routeEls.controls;
  if (!container) return;
  container.innerHTML = "";

  COLOR_ORDER.forEach(color => {
    const block = document.createElement("div");
    block.className = "route-player-controls";
    block.dataset.color = color;

    const label = document.createElement("div");
    label.className = "route-player-label";
    label.textContent = PLAYER_LABELS[color];
    block.append(label);

    [
      { dir: "up", text: "↑", title: "Haut" },
      { dir: "straight", text: "↔", title: "Gauche / Droite" },
      { dir: "down", text: "↓", title: "Bas" },
    ].forEach(({ dir, text, title }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "route-move-btn";
      btn.dataset.color = color;
      btn.dataset.direction = dir;
      btn.title = title;
      btn.textContent = text;
      btn.addEventListener("click", () => moveRoutePawn(color, dir));
      block.append(btn);
    });

    container.append(block);
  });
}

function routeNodeElement(nodeId) {
  return routeEls.board && routeEls.board.querySelector('[data-node="' + nodeId + '"]');
}

function routePawnsOnNode(nodeId) {
  return COLOR_ORDER.filter(color => stateRoute.pawnPositions[color] === nodeId);
}

function appendRoutePawn(layer, color, index) {
  const img = document.createElement("img");
  img.className = "route-pawn";
  img.src = ROUTE_PAWN_IMAGES[color];
  img.alt = "Pion " + PLAYER_LABELS[color];
  img.dataset.slot = String(index);
  layer.append(img);
}

function drawRoutePawns() {
  routeAllNodeIds().forEach(nodeId => {
    const node = routeNodeElement(nodeId);
    if (!node) return;

    const pawns = routePawnsOnNode(nodeId);
    const slotPaintOrder = [2, 3, 0, 1];
    const ordered = pawns
      .map((color, index) => ({ color, index }))
      .sort((a, b) => slotPaintOrder.indexOf(a.index) - slotPaintOrder.indexOf(b.index));

    if (nodeId === "start") {
      const topCol = node.querySelector(".route-pawns-top-col");
      const bottomCol = node.querySelector(".route-pawns-bottom-col");
      if (!topCol || !bottomCol) return;
      topCol.innerHTML = "";
      bottomCol.innerHTML = "";
      ordered.forEach(({ color, index }) => {
        const layer = index < 2 ? topCol : bottomCol;
        appendRoutePawn(layer, color, index);
      });
      return;
    }

    const layer = node.querySelector(".route-pawns");
    if (!layer) return;
    layer.innerHTML = "";
    ordered.forEach(({ color, index }) => {
      appendRoutePawn(layer, color, index);
    });
  });
}

function drawRouteCells() {
  routeAllNodeIds().forEach(nodeId => {
    if (nodeId === "start" || nodeId === "finish") return;
    const node = routeNodeElement(nodeId);
    if (!node) return;
    const textEl = node.querySelector(".route-cell-text");
    if (textEl) textEl.textContent = stateRoute.texts[nodeId] || "";
  });
}

function nodeCenter(node, boardRect) {
  const rect = node.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - boardRect.left,
    y: rect.top + rect.height / 2 - boardRect.top,
  };
}

function routeNodeRowCol(nodeId) {
  if (nodeId === "start" || nodeId === "finish") return null;
  const parts = nodeId.split("-");
  return { section: parts[0], col: Number(parts[1]), row: Number(parts[2]) };
}

function routeMovesRight(fromId, toId) {
  if (fromId === "start") return true;
  if (fromId.startsWith("t-") && toId.startsWith("t-")) {
    return routeNodeRowCol(toId).col > routeNodeRowCol(fromId).col;
  }
  return false;
}

function routeMovesLeft(fromId, toId) {
  if (toId === "finish") return true;
  if (fromId.startsWith("b-") && toId.startsWith("b-")) {
    return routeNodeRowCol(toId).col < routeNodeRowCol(fromId).col;
  }
  return false;
}

function sideAnchor(node, boardRect, side, y) {
  const rect = node.getBoundingClientRect();
  const x = side === "right"
    ? rect.right - boardRect.left
    : rect.left - boardRect.left;
  const anchorY = y !== undefined
    ? y
    : rect.top + rect.height / 2 - boardRect.top;
  return { x, y: anchorY };
}

function edgeGapKey(fromId, toId) {
  if (fromId === "start") return "start-t0";
  if (toId === "finish") return "b0-finish";
  if (fromId.startsWith("t-2-") && toId.startsWith("b-2-")) return "crossover";
  const from = routeNodeRowCol(fromId);
  const to = routeNodeRowCol(toId);
  return from.section + "-" + Math.min(from.col, to.col) + "-" + Math.max(from.col, to.col);
}

function appendSvgLine(svg, x1, y1, x2, y2, className, withMarker) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "line");
  el.setAttribute("x1", String(x1));
  el.setAttribute("y1", String(y1));
  el.setAttribute("x2", String(x2));
  el.setAttribute("y2", String(y2));
  if (className) el.setAttribute("class", className);
  if (withMarker) el.setAttribute("marker-end", "url(#route-arrowhead)");
  svg.appendChild(el);
}

function drawGapArrows(svg, edges, gapKey, boardRect) {
  const [fromId0, toId0] = edges[0];
  const movingRight = routeMovesRight(fromId0, toId0);
  const movingLeft = routeMovesLeft(fromId0, toId0);
  const isCrossover = gapKey === "crossover";
  const isSimpleGap = gapKey === "start-t0" || gapKey === "b0-finish";

  const fromNode0 = routeNodeElement(fromId0);
  const toNode0 = routeNodeElement(toId0);
  if (!fromNode0 || !toNode0) return;

  if (isSimpleGap) {
    edges.forEach(([fromId, toId]) => {
      const fromNode = routeNodeElement(fromId);
      const toNode = routeNodeElement(toId);
      if (!fromNode || !toNode) return;

      const fromCenter = nodeCenter(fromNode, boardRect);
      const toCenter = nodeCenter(toNode, boardRect);

      if (gapKey === "start-t0") {
        const startPt = sideAnchor(fromNode, boardRect, "right", toCenter.y);
        const endPt = sideAnchor(toNode, boardRect, "left", toCenter.y);
        appendSvgLine(svg, startPt.x, startPt.y, endPt.x, endPt.y, "route-branch-out", true);
      } else {
        const startPt = sideAnchor(fromNode, boardRect, "left", fromCenter.y);
        const endPt = sideAnchor(toNode, boardRect, "right", fromCenter.y);
        appendSvgLine(svg, startPt.x, startPt.y, endPt.x, endPt.y, "route-branch-out", true);
      }
    });
    return;
  }

  let trunkX;
  if (isCrossover) {
    const rect = fromNode0.getBoundingClientRect();
    trunkX = rect.right - boardRect.left + Math.max(28, boardRect.width * 0.055);
  } else {
    const fromRect = fromNode0.getBoundingClientRect();
    const toRect = toNode0.getBoundingClientRect();
    trunkX = (fromRect.right - boardRect.left + toRect.left - boardRect.left) / 2;
  }

  const branchYs = [];
  const branchLines = [];

  edges.forEach(([fromId, toId]) => {
    const fromNode = routeNodeElement(fromId);
    const toNode = routeNodeElement(toId);
    if (!fromNode || !toNode) return;

    const fromCenter = nodeCenter(fromNode, boardRect);
    const toCenter = nodeCenter(toNode, boardRect);

    if (isCrossover) {
      const fromRect = fromNode.getBoundingClientRect();
      const toRect = toNode.getBoundingClientRect();
      const sx = fromRect.right - boardRect.left;
      const ex = toRect.right - boardRect.left;
      branchYs.push(fromCenter.y, toCenter.y);
      branchLines.push([sx, fromCenter.y, trunkX, fromCenter.y, "route-branch-in", false]);
      branchLines.push([trunkX, toCenter.y, ex, toCenter.y, "route-branch-out", true]);
    } else if (movingRight) {
      const branchY = fromId === "start" ? toCenter.y : fromCenter.y;
      const startPt = sideAnchor(fromNode, boardRect, "right", branchY);
      const endPt = sideAnchor(toNode, boardRect, "left", toCenter.y);
      branchYs.push(startPt.y, endPt.y);
      branchLines.push([startPt.x, startPt.y, trunkX, startPt.y, "route-branch-in", false]);
      branchLines.push([trunkX, endPt.y, endPt.x, endPt.y, "route-branch-out", true]);
    } else if (movingLeft) {
      const startPt = sideAnchor(fromNode, boardRect, "left", fromCenter.y);
      const targetY = toId === "finish" ? fromCenter.y : toCenter.y;
      const endPt = sideAnchor(toNode, boardRect, "right", targetY);
      branchYs.push(startPt.y, endPt.y);
      branchLines.push([startPt.x, startPt.y, trunkX, startPt.y, "route-branch-in", false]);
      branchLines.push([trunkX, endPt.y, endPt.x, endPt.y, "route-branch-out", true]);
    }
  });

  if (!branchYs.length) return;

  const protrusion = Math.max(16, (Math.max(...branchYs) - Math.min(...branchYs)) * 0.15 + 12);
  const minY = Math.min(...branchYs) - protrusion;
  const maxY = Math.max(...branchYs) + protrusion;

  appendSvgLine(svg, trunkX, minY, trunkX, maxY, "route-trunk", false);
  branchLines.forEach(([x1, y1, x2, y2, className, withMarker]) => {
    appendSvgLine(svg, x1, y1, x2, y2, className, withMarker);
  });
}

function drawRouteArrows() {
  const svg = routeEls.arrowsSvg;
  const board = routeEls.board;
  if (!svg || !board) return;

  const boardRect = board.getBoundingClientRect();
  svg.setAttribute("viewBox", "0 0 " + boardRect.width + " " + boardRect.height);
  svg.innerHTML = '<defs><marker id="route-arrowhead" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><polygon points="0 0, 7 3.5, 0 7" fill="#4a5568" /></marker></defs>';

  const groups = new Map();
  ROUTE_ARROW_EDGES.forEach(([fromId, toId]) => {
    const key = edgeGapKey(fromId, toId);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push([fromId, toId]);
  });

  groups.forEach((edges, gapKey) => {
    drawGapArrows(svg, edges, gapKey, boardRect);
  });
}

function updateRouteMoveButtons() {
  if (!routeEls.controls) return;
  routeEls.controls.querySelectorAll(".route-player-controls").forEach(block => {
    block.classList.toggle("game-over", stateRoute.gameOver);
    const color = block.dataset.color;
    const current = stateRoute.pawnPositions[color];
    const available = ROUTE_MOVES[current] || {};
    block.querySelectorAll(".route-move-btn").forEach(btn => {
      const dir = btn.dataset.direction;
      const enabled = stateRoute.started && !stateRoute.gameOver && Boolean(available[dir]);
      btn.disabled = !enabled;
    });
  });
}

function moveRoutePawn(color, direction) {
  if (!stateRoute.started || stateRoute.gameOver) return;
  const current = stateRoute.pawnPositions[color];
  const next = ROUTE_MOVES[current] && ROUTE_MOVES[current][direction];
  if (!next) return;

  stateRoute.pawnPositions[color] = next;
  drawRoutePawns();
  updateRouteMoveButtons();

  if (next === "finish") {
    stateRoute.gameOver = true;
    stateRoute.winner = color;
    showMessage("Victoire !", "Le joueur " + PLAYER_LABELS[color] + " est vainqueur !");
    updateRouteMoveButtons();
  }
}

function fillRouteBoard() {
  const entries = filteredEntries();
  if (entries.length < ROUTE_CELL_COUNT) {
    showMessage(
      "Erreur",
      "Pas assez de propositions pour les critères choisis (longueur " +
        els.lengthMin.value +
        " à " +
        els.lengthMax.value +
        ").\nIl en faut au moins " +
        ROUTE_CELL_COUNT +
        ", actuellement " +
        entries.length +
        "."
    );
    return;
  }

  const column = propositionColumn();
  const selected = shuffle(entries).slice(0, ROUTE_CELL_COUNT);
  const cellIds = routeAllNodeIds().filter(id => id !== "start" && id !== "finish");

  stateRoute.texts = {};
  cellIds.forEach((id, index) => {
    stateRoute.texts[id] = selected[index][column];
  });

  stateRoute.pawnPositions = { green: "start", red: "start", blue: "start", yellow: "start" };
  stateRoute.started = true;
  stateRoute.gameOver = false;
  stateRoute.winner = null;

  drawRouteCells();
  drawRoutePawns();
  updateRouteMoveButtons();
  requestAnimationFrame(() => drawRouteArrows());
}

function resetRouteScreen() {
  state.mode = "route";
  stateRoute.texts = {};
  stateRoute.pawnPositions = { green: "start", red: "start", blue: "start", yellow: "start" };
  stateRoute.started = false;
  stateRoute.gameOver = false;
  stateRoute.winner = null;

  buildRouteBoard();
  buildRouteControls();
  drawRouteCells();
  drawRoutePawns();
  updateRouteMoveButtons();
  requestAnimationFrame(() => drawRouteArrows());
}

function initRouteModule() {
  routeEls.board = document.querySelector("#route-board");
  routeEls.arrowsSvg = document.querySelector("#route-arrows");
  routeEls.fillBtn = document.querySelector("#fill-route");
  routeEls.controls = document.querySelector("#route-controls");

  if (routeEls.fillBtn) {
    routeEls.fillBtn.addEventListener("click", fillRouteBoard);
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (state.mode !== "route") return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => drawRouteArrows(), 120);
  });
}
