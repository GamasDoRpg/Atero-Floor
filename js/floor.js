import {
  createFloor,
  createId,
  exportProject,
  getProject,
  saveProject
} from "./storage.js?v=2";

const PX_PER_METER = 100;
const MAX_HISTORY = 80;
const shell = document.querySelector(".app-shell");

let project = null;
let currentUser = null;
let selection = null;
let tool = "select";
let draft = null;
let drag = null;
let hoveredPoint = null;
let activeLibraryItem = null;
let saveTimer = null;
let spacePressed = false;
let historyPast = [];
let historyFuture = [];
let view = { x: 260, y: 130, scale: 0.78 };

const TOOL_HINTS = {
  select: "Selecione e arraste elementos. Use Delete para excluir.",
  wall: "Clique para iniciar uma parede e clique novamente para concluir. Esc encerra a sequência.",
  room: "Clique e arraste para criar um cômodo retangular completo.",
  door: "Clique sobre uma parede para inserir uma porta.",
  window: "Clique sobre uma parede para inserir uma janela.",
  measure: "Clique em dois pontos para criar uma medida.",
  text: "Clique na planta para inserir uma anotação.",
  pan: "Arraste a prancheta. Você também pode segurar Espaço em qualquer ferramenta.",
  "place-item": "Clique na planta para posicionar o objeto selecionado."
};

const LIBRARY = [
  { kind: "sofa", name: "Sofá", icon: "▰", width: 2.1, depth: 0.9 },
  { kind: "bed", name: "Cama casal", icon: "▤", width: 2.1, depth: 1.6 },
  { kind: "single-bed", name: "Cama solteiro", icon: "▥", width: 1.9, depth: 0.9 },
  { kind: "table", name: "Mesa", icon: "▣", width: 1.4, depth: 0.8 },
  { kind: "desk", name: "Escrivaninha", icon: "▱", width: 1.3, depth: 0.65 },
  { kind: "cabinet", name: "Armário", icon: "▥", width: 1.8, depth: 0.6 },
  { kind: "toilet", name: "Vaso", icon: "◉", width: 0.7, depth: 0.8 },
  { kind: "sink", name: "Pia", icon: "◌", width: 0.8, depth: 0.55 }
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeXml(value) {
  return escapeHtml(value);
}

function icon(name) {
  const icons = {
    back: '<path d="m15 18-6-6 6-6"/><path d="M9 12h10"/>',
    select: '<path d="m5 3 12 8-6 2-2 6z"/>',
    wall: '<path d="M4 5h16v5H4z"/><path d="M7 10v9M17 10v9"/>',
    room: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M12 4v8h8M4 14h8v6"/>',
    door: '<path d="M5 20V4h10v16"/><path d="M15 20A10 10 0 0 0 5 10"/>',
    window: '<path d="M4 7h16v10H4z"/><path d="M8 7v10M16 7v10"/>',
    measure: '<path d="M4 16 16 4l4 4L8 20z"/><path d="m12 8 4 4M8 12l2 2"/>',
    text: '<path d="M5 5h14M12 5v14M8 19h8"/>',
    hand: '<path d="M7 11V7a2 2 0 0 1 4 0v3-5a2 2 0 0 1 4 0v5-3a2 2 0 0 1 4 0v7c0 4-3 7-7 7h-1c-3 0-5-2-6-4l-2-4a2 2 0 0 1 4-2z"/>',
    undo: '<path d="M9 7 4 12l5 5"/><path d="M4 12h9a6 6 0 0 1 6 6"/>',
    redo: '<path d="m15 7 5 5-5 5"/><path d="M20 12h-9a6 6 0 0 0-6 6"/>',
    export: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 14v6h14v-6"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    fit: '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/>',
    duplicate: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    inspector: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="11" cy="18" r="2"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ""}</svg>`;
}

function activeFloor() {
  return project.floors.find(floor => floor.id === project.activeFloorId) || project.floors[0];
}

function arraysForFloor(floor = activeFloor()) {
  return [floor.walls, floor.openings, floor.rooms, floor.items, floor.labels, floor.measurements];
}

function findEntity(id) {
  if (!id) return null;
  for (const list of arraysForFloor()) {
    const entity = list.find(item => item.id === id);
    if (entity) return entity;
  }
  return null;
}

function findEntityList(id) {
  for (const list of arraysForFloor()) {
    if (list.some(item => item.id === id)) return list;
  }
  return null;
}

function clone(value) {
  return structuredClone(value);
}

function serializeProject() {
  return JSON.stringify(project);
}

function recordHistory(snapshot = serializeProject()) {
  historyPast.push(snapshot);
  if (historyPast.length > MAX_HISTORY) historyPast.shift();
  historyFuture = [];
  updateHistoryButtons();
}

function commitChange(mutator, { renderAfter = true } = {}) {
  recordHistory();
  mutator();
  queueSave();
  if (renderAfter) renderAll();
}

function undo() {
  if (!historyPast.length) return;
  historyFuture.push(serializeProject());
  project = JSON.parse(historyPast.pop());
  selection = null;
  draft = null;
  saveNow();
  renderAll();
}

function redo() {
  if (!historyFuture.length) return;
  historyPast.push(serializeProject());
  project = JSON.parse(historyFuture.pop());
  selection = null;
  draft = null;
  saveNow();
  renderAll();
}

function updateHistoryButtons() {
  const undoButton = document.querySelector('[data-action="undo"]');
  const redoButton = document.querySelector('[data-action="redo"]');
  if (undoButton) undoButton.disabled = !historyPast.length;
  if (redoButton) redoButton.disabled = !historyFuture.length;
}

function setSaveState(text) {
  const element = document.querySelector("#save-state");
  if (element) element.textContent = text;
}

function queueSave() {
  setSaveState("Salvando…");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}

function saveNow() {
  clearTimeout(saveTimer);
  project = saveProject(project);
  setSaveState("Salvo neste navegador");
}

function toast(message) {
  const stack = document.querySelector(".toast-stack");
  if (!stack) return;
  const element = document.createElement("div");
  element.className = "toast";
  element.textContent = message;
  stack.append(element);
  setTimeout(() => element.remove(), 2800);
}

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(Number(value) || 0);
}

function formatMeters(value) {
  return `${formatNumber(value, 2)} m`;
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function wallLength(wall) {
  return Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
}

function pointOnWall(wall, offset) {
  return {
    x: wall.x1 + (wall.x2 - wall.x1) * offset,
    y: wall.y1 + (wall.y2 - wall.y1) * offset
  };
}

function projectPointToWall(point, wall) {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return { offset: 0, point: { x: wall.x1, y: wall.y1 }, distance: distance(point, { x: wall.x1, y: wall.y1 }) };

  const rawOffset = ((point.x - wall.x1) * dx + (point.y - wall.y1) * dy) / lengthSquared;
  const offset = Math.max(0, Math.min(1, rawOffset));
  const projected = pointOnWall(wall, offset);
  return { offset, point: projected, distance: distance(point, projected) };
}

function nearestWall(point, tolerance = 0.25) {
  let best = null;
  for (const wall of activeFloor().walls) {
    const projection = projectPointToWall(point, wall);
    if (projection.distance <= tolerance && (!best || projection.distance < best.distance)) {
      best = { wall, ...projection };
    }
  }
  return best;
}

function snappedPoint(point, { endpoints = true } = {}) {
  let result = { ...point };
  if (project.settings.snap) {
    const grid = Number(project.settings.gridSize) || 0.1;
    result.x = Math.round(result.x / grid) * grid;
    result.y = Math.round(result.y / grid) * grid;
  }

  if (endpoints) {
    let nearest = null;
    for (const wall of activeFloor().walls) {
      for (const endpoint of [{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }]) {
        const d = distance(result, endpoint);
        if (d < 0.18 && (!nearest || d < nearest.distance)) nearest = { point: endpoint, distance: d };
      }
    }
    if (nearest) result = { ...nearest.point };
  }

  return {
    x: Math.round(result.x * 10000) / 10000,
    y: Math.round(result.y * 10000) / 10000
  };
}

function svgPoint(event) {
  const svg = document.querySelector("#plan-svg");
  const rect = svg.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left - view.x) / view.scale) / PX_PER_METER,
    y: ((event.clientY - rect.top - view.y) / view.scale) / PX_PER_METER
  };
}

function toPx(value) {
  return value * PX_PER_METER;
}

function renderRoom(room) {
  const selected = selection?.id === room.id;
  const x = toPx(room.x);
  const y = toPx(room.y);
  const width = toPx(room.width);
  const height = toPx(room.height);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  return `
    <g data-entity-id="${room.id}" data-entity-type="room">
      <rect class="room-shape" x="${x}" y="${y}" width="${width}" height="${height}" fill="${escapeXml(room.fill || "#f7e7e2")}" ${selected ? 'stroke="#b95e4e" stroke-width="2"' : ""}/>
      <rect class="entity-hit" x="${x}" y="${y}" width="${width}" height="${height}"/>
      <text class="room-label" x="${centerX}" y="${centerY - 2}">${escapeXml(room.name || "Ambiente")}</text>
      <text class="room-area" x="${centerX}" y="${centerY + 14}">${formatNumber(room.width * room.height, 2)} m²</text>
    </g>
  `;
}

function renderWall(wall) {
  const selected = selection?.id === wall.id;
  return `
    <g data-entity-id="${wall.id}" data-entity-type="wall">
      <line class="wall-line ${selected ? "selected" : ""}" x1="${toPx(wall.x1)}" y1="${toPx(wall.y1)}" x2="${toPx(wall.x2)}" y2="${toPx(wall.y2)}" stroke-width="${Math.max(3, toPx(wall.thickness || 0.15))}"/>
      <line class="entity-hit" x1="${toPx(wall.x1)}" y1="${toPx(wall.y1)}" x2="${toPx(wall.x2)}" y2="${toPx(wall.y2)}"/>
    </g>
  `;
}

function renderOpening(opening) {
  const wall = activeFloor().walls.find(item => item.id === opening.wallId);
  if (!wall) return "";

  const center = pointOnWall(wall, opening.offset);
  const angle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1);
  const half = opening.width / 2;
  const start = { x: center.x - Math.cos(angle) * half, y: center.y - Math.sin(angle) * half };
  const end = { x: center.x + Math.cos(angle) * half, y: center.y + Math.sin(angle) * half };
  const selected = selection?.id === opening.id;
  const cutWidth = Math.max(6, toPx(wall.thickness || 0.15) + 4);

  let symbol = "";
  if (opening.type === "window") {
    symbol = `
      <line class="window-line" x1="${toPx(start.x)}" y1="${toPx(start.y)}" x2="${toPx(end.x)}" y2="${toPx(end.y)}"/>
      <line class="window-line" x1="${toPx(start.x - Math.sin(angle) * 0.035)}" y1="${toPx(start.y + Math.cos(angle) * 0.035)}" x2="${toPx(end.x - Math.sin(angle) * 0.035)}" y2="${toPx(end.y + Math.cos(angle) * 0.035)}"/>
    `;
  } else {
    const hinge = opening.swing === "right" ? end : start;
    const sign = opening.swing === "right" ? -1 : 1;
    const leafEnd = {
      x: hinge.x - Math.sin(angle) * opening.width * sign,
      y: hinge.y + Math.cos(angle) * opening.width * sign
    };
    const sweep = opening.swing === "right" ? 0 : 1;
    symbol = `
      <line class="door-leaf" x1="${toPx(hinge.x)}" y1="${toPx(hinge.y)}" x2="${toPx(leafEnd.x)}" y2="${toPx(leafEnd.y)}"/>
      <path class="door-leaf" d="M ${toPx(opening.swing === "right" ? start.x : end.x)} ${toPx(opening.swing === "right" ? start.y : end.y)} A ${toPx(opening.width)} ${toPx(opening.width)} 0 0 ${sweep} ${toPx(leafEnd.x)} ${toPx(leafEnd.y)}"/>
    `;
  }

  return `
    <g data-entity-id="${opening.id}" data-entity-type="${opening.type}">
      <line class="opening-cut" x1="${toPx(start.x)}" y1="${toPx(start.y)}" x2="${toPx(end.x)}" y2="${toPx(end.y)}" stroke-width="${cutWidth}"/>
      ${symbol}
      <line class="entity-hit" x1="${toPx(start.x)}" y1="${toPx(start.y)}" x2="${toPx(end.x)}" y2="${toPx(end.y)}" ${selected ? 'stroke="#b95e4e" stroke-width="4"' : ""}/>
    </g>
  `;
}

function furnitureDetails(item) {
  const x = toPx(item.x);
  const y = toPx(item.y);
  const width = toPx(item.width);
  const depth = toPx(item.depth);
  let details = "";

  if (item.kind.includes("bed")) {
    details = `<rect x="${x + width * 0.08}" y="${y + depth * 0.08}" width="${width * 0.84}" height="${depth * 0.24}" rx="5" fill="#fff" stroke="#b9ada8" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  } else if (item.kind === "sofa") {
    details = `<path d="M ${x + width * 0.1} ${y + depth * 0.28} H ${x + width * 0.9} V ${y + depth * 0.78} H ${x + width * 0.1} Z" fill="none" stroke="#b2a6a1" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  } else if (item.kind === "table" || item.kind === "desk") {
    details = `<line x1="${x + width * 0.1}" y1="${y + depth * 0.5}" x2="${x + width * 0.9}" y2="${y + depth * 0.5}" stroke="#b2a6a1" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  } else if (item.kind === "toilet" || item.kind === "sink") {
    details = `<ellipse cx="${x + width / 2}" cy="${y + depth / 2}" rx="${width * 0.28}" ry="${depth * 0.34}" fill="#fff" stroke="#b2a6a1" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  }

  return details;
}

function renderItem(item) {
  const selected = selection?.id === item.id;
  const x = toPx(item.x);
  const y = toPx(item.y);
  const width = toPx(item.width);
  const depth = toPx(item.depth);
  const cx = x + width / 2;
  const cy = y + depth / 2;
  return `
    <g data-entity-id="${item.id}" data-entity-type="item" transform="rotate(${item.rotation || 0} ${cx} ${cy})">
      <rect class="furniture-shape ${selected ? "selected" : ""}" x="${x}" y="${y}" width="${width}" height="${depth}" rx="5"/>
      ${furnitureDetails(item)}
      <text class="item-label" x="${cx}" y="${cy + 3}">${escapeXml(item.name)}</text>
    </g>
  `;
}

function renderLabel(label) {
  const selected = selection?.id === label.id;
  return `
    <g data-entity-id="${label.id}" data-entity-type="label">
      <text class="text-label" x="${toPx(label.x)}" y="${toPx(label.y)}" font-size="${label.size || 16}" ${selected ? 'fill="#b95e4e"' : ""}>${escapeXml(label.text)}</text>
    </g>
  `;
}

function renderMeasurement(measurement) {
  const midpoint = { x: (measurement.x1 + measurement.x2) / 2, y: (measurement.y1 + measurement.y2) / 2 };
  const length = Math.hypot(measurement.x2 - measurement.x1, measurement.y2 - measurement.y1);
  const selected = selection?.id === measurement.id;
  return `
    <g data-entity-id="${measurement.id}" data-entity-type="measurement">
      <line class="measure-line" x1="${toPx(measurement.x1)}" y1="${toPx(measurement.y1)}" x2="${toPx(measurement.x2)}" y2="${toPx(measurement.y2)}" ${selected ? 'stroke-width="2.2"' : ""}/>
      <line class="entity-hit" x1="${toPx(measurement.x1)}" y1="${toPx(measurement.y1)}" x2="${toPx(measurement.x2)}" y2="${toPx(measurement.y2)}"/>
      <text class="measure-text" x="${toPx(midpoint.x)}" y="${toPx(midpoint.y) - 7}">${formatMeters(length)}</text>
    </g>
  `;
}

function renderSelectionOverlay() {
  const entity = findEntity(selection?.id);
  if (!entity) return "";

  if (entity.type === "wall") {
    return `
      <circle class="selection-handle" data-handle="start" data-entity-id="${entity.id}" cx="${toPx(entity.x1)}" cy="${toPx(entity.y1)}" r="6"/>
      <circle class="selection-handle" data-handle="end" data-entity-id="${entity.id}" cx="${toPx(entity.x2)}" cy="${toPx(entity.y2)}" r="6"/>
    `;
  }

  if (entity.type === "measurement") {
    return `
      <circle class="selection-handle" data-handle="start" data-entity-id="${entity.id}" cx="${toPx(entity.x1)}" cy="${toPx(entity.y1)}" r="5"/>
      <circle class="selection-handle" data-handle="end" data-entity-id="${entity.id}" cx="${toPx(entity.x2)}" cy="${toPx(entity.y2)}" r="5"/>
    `;
  }

  return "";
}

function renderDraftOverlay() {
  if (!draft || !hoveredPoint) return "";

  if (draft.type === "wall" || draft.type === "measurement") {
    return `
      <line class="preview-line" x1="${toPx(draft.start.x)}" y1="${toPx(draft.start.y)}" x2="${toPx(hoveredPoint.x)}" y2="${toPx(hoveredPoint.y)}"/>
      <circle class="snap-point" cx="${toPx(hoveredPoint.x)}" cy="${toPx(hoveredPoint.y)}" r="4"/>
    `;
  }

  if (draft.type === "room") {
    const x = Math.min(draft.start.x, hoveredPoint.x);
    const y = Math.min(draft.start.y, hoveredPoint.y);
    const width = Math.abs(hoveredPoint.x - draft.start.x);
    const height = Math.abs(hoveredPoint.y - draft.start.y);
    return `<rect class="preview-room" x="${toPx(x)}" y="${toPx(y)}" width="${toPx(width)}" height="${toPx(height)}"/>`;
  }

  return "";
}

function entityMarkup() {
  const floor = activeFloor();
  return [
    ...floor.rooms.map(renderRoom),
    ...floor.walls.map(renderWall),
    ...floor.openings.map(renderOpening),
    ...floor.items.map(renderItem),
    ...floor.labels.map(renderLabel),
    ...floor.measurements.map(renderMeasurement)
  ].join("");
}

function renderCanvas() {
  const viewport = document.querySelector("#viewport");
  const objectLayer = document.querySelector("#object-layer");
  const overlayLayer = document.querySelector("#overlay-layer");
  const svg = document.querySelector("#plan-svg");
  if (!viewport || !objectLayer || !overlayLayer) return;

  viewport.setAttribute("transform", `translate(${view.x} ${view.y}) scale(${view.scale})`);
  objectLayer.innerHTML = entityMarkup();
  overlayLayer.innerHTML = renderSelectionOverlay() + renderDraftOverlay();
  svg.dataset.tool = tool;
  document.querySelector("#zoom-value").textContent = `${Math.round(view.scale * 100)}%`;
}

function totalWallLength(floor = activeFloor()) {
  return floor.walls.reduce((sum, wall) => sum + wallLength(wall), 0);
}

function totalArea(floor = activeFloor()) {
  return floor.rooms.reduce((sum, room) => sum + room.width * room.height, 0);
}

function renderFloorTabs() {
  const container = document.querySelector("#floor-tabs");
  if (!container) return;
  container.innerHTML = project.floors.map(floor => `
    <button class="floor-tab ${floor.id === project.activeFloorId ? "active" : ""}" type="button" data-floor-id="${floor.id}">${escapeHtml(floor.name)}</button>
  `).join("") + '<button class="floor-tab floor-add" type="button" data-action="add-floor" aria-label="Adicionar pavimento" title="Adicionar pavimento">＋</button>';
}

function selectedTypeLabel(entity) {
  const labels = {
    wall: "Parede",
    door: "Porta",
    window: "Janela",
    room: "Cômodo",
    item: "Mobiliário",
    label: "Anotação",
    measurement: "Medida"
  };
  return labels[entity?.type] || "Propriedades";
}

function field({ label, key, value, type = "number", step = "0.01", min, options, full = false }) {
  const attributes = [
    `data-property="${key}"`,
    type ? `type="${type}"` : "",
    step ? `step="${step}"` : "",
    min !== undefined ? `min="${min}"` : ""
  ].filter(Boolean).join(" ");

  let control;
  if (options) {
    control = `<select data-property="${key}">${options.map(option => `<option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select>`;
  } else {
    control = `<input ${attributes} value="${escapeHtml(value)}">`;
  }

  return `<div class="property-field ${full ? "full" : ""}"><label>${label}</label>${control}</div>`;
}

function inspectorForEntity(entity) {
  if (entity.type === "wall") {
    return `
      <section class="inspector-section">
        <h3>Geometria</h3>
        <div class="property-grid">
          ${field({ label: "Comprimento", key: "length", value: wallLength(entity).toFixed(2), min: 0.1 })}
          ${field({ label: "Espessura", key: "thickness", value: entity.thickness, step: "0.01", min: 0.05 })}
          ${field({ label: "Altura", key: "height", value: entity.height, step: "0.1", min: 0.5 })}
          ${field({ label: "Material", key: "material", value: entity.material || "Alvenaria", type: "text", step: "", full: true })}
        </div>
      </section>
    `;
  }

  if (entity.type === "door" || entity.type === "window") {
    return `
      <section class="inspector-section">
        <h3>Dimensões</h3>
        <div class="property-grid">
          ${field({ label: "Largura", key: "width", value: entity.width, min: 0.3 })}
          ${field({ label: "Altura", key: "height", value: entity.height, min: 0.3 })}
          ${entity.type === "window" ? field({ label: "Peitoril", key: "sill", value: entity.sill, min: 0 }) : field({ label: "Abertura", key: "swing", value: entity.swing, options: [{ value: "left", label: "Esquerda" }, { value: "right", label: "Direita" }] })}
        </div>
      </section>
    `;
  }

  if (entity.type === "room") {
    return `
      <section class="inspector-section">
        <h3>Ambiente</h3>
        <div class="property-grid">
          ${field({ label: "Nome", key: "name", value: entity.name, type: "text", step: "", full: true })}
          ${field({ label: "Largura", key: "width", value: entity.width, min: 0.2 })}
          ${field({ label: "Profundidade", key: "height", value: entity.height, min: 0.2 })}
          ${field({ label: "Cor", key: "fill", value: entity.fill || "#f7e7e2", type: "color", step: "", full: true })}
        </div>
        <div class="summary-row" style="margin-top:12px"><span>Área</span><strong>${formatNumber(entity.width * entity.height, 2)} m²</strong></div>
      </section>
    `;
  }

  if (entity.type === "item") {
    return `
      <section class="inspector-section">
        <h3>Objeto</h3>
        <div class="property-grid">
          ${field({ label: "Nome", key: "name", value: entity.name, type: "text", step: "", full: true })}
          ${field({ label: "Largura", key: "width", value: entity.width, min: 0.1 })}
          ${field({ label: "Profundidade", key: "depth", value: entity.depth, min: 0.1 })}
          ${field({ label: "Rotação", key: "rotation", value: entity.rotation || 0, step: "1" })}
        </div>
      </section>
    `;
  }

  if (entity.type === "label") {
    return `
      <section class="inspector-section">
        <h3>Texto</h3>
        <div class="property-grid">
          ${field({ label: "Conteúdo", key: "text", value: entity.text, type: "text", step: "", full: true })}
          ${field({ label: "Tamanho", key: "size", value: entity.size || 16, step: "1", min: 8 })}
        </div>
      </section>
    `;
  }

  if (entity.type === "measurement") {
    return `
      <section class="inspector-section">
        <h3>Distância</h3>
        <div class="summary-row"><span>Comprimento</span><strong>${formatMeters(Math.hypot(entity.x2 - entity.x1, entity.y2 - entity.y1))}</strong></div>
      </section>
    `;
  }

  return "";
}

function renderInspector() {
  const header = document.querySelector("#inspector-header");
  const body = document.querySelector("#inspector-body");
  if (!header || !body) return;

  const entity = findEntity(selection?.id);
  if (entity) {
    header.innerHTML = `<p class="inspector-kicker">Selecionado</p><h2>${selectedTypeLabel(entity)}</h2>`;
    body.innerHTML = `
      ${inspectorForEntity(entity)}
      <section class="inspector-section">
        <div class="inspector-actions">
          <button class="inspector-button" type="button" data-action="duplicate-selection">Duplicar</button>
          <button class="inspector-button danger" type="button" data-action="delete-selection">Excluir</button>
        </div>
      </section>
    `;
    return;
  }

  const floor = activeFloor();
  header.innerHTML = `<p class="inspector-kicker">Pavimento</p><h2>${escapeHtml(floor.name)}</h2>`;
  body.innerHTML = `
    <section class="inspector-section">
      <h3>Resumo</h3>
      <div class="summary-list">
        <div class="summary-row"><span>Área definida</span><strong>${formatNumber(totalArea(floor), 2)} m²</strong></div>
        <div class="summary-row"><span>Paredes</span><strong>${floor.walls.length}</strong></div>
        <div class="summary-row"><span>Comprimento total</span><strong>${formatMeters(totalWallLength(floor))}</strong></div>
        <div class="summary-row"><span>Aberturas</span><strong>${floor.openings.length}</strong></div>
      </div>
    </section>
    <section class="inspector-section">
      <h3>Configuração</h3>
      <div class="property-grid">
        ${field({ label: "Nome", key: "floor.name", value: floor.name, type: "text", step: "", full: true })}
        ${field({ label: "Elevação", key: "floor.elevation", value: floor.elevation || 0, step: "0.1" })}
        ${field({ label: "Pé-direito", key: "floor.ceilingHeight", value: floor.ceilingHeight || 2.8, step: "0.1", min: 1 })}
      </div>
    </section>
    <section class="inspector-section">
      <h3>Biblioteca</h3>
      <div class="library-grid">
        ${LIBRARY.map(item => `<button class="library-item" type="button" data-library-kind="${item.kind}"><span>${item.icon}</span><span>${escapeHtml(item.name)}</span></button>`).join("")}
      </div>
    </section>
    ${project.floors.length > 1 ? '<section class="inspector-section"><button class="inspector-button danger" type="button" data-action="delete-floor">Excluir este pavimento</button></section>' : ""}
  `;
}

function renderStatus() {
  const floor = activeFloor();
  const area = document.querySelector("#status-area");
  const walls = document.querySelector("#status-walls");
  if (area) area.textContent = `Área: ${formatNumber(totalArea(floor), 2)} m²`;
  if (walls) walls.textContent = `${floor.walls.length} paredes`;
  const snap = document.querySelector("#snap-toggle");
  const grid = document.querySelector("#grid-toggle");
  if (snap) snap.checked = Boolean(project.settings.snap);
  if (grid) grid.checked = Boolean(project.settings.showGrid);
  const gridRect = document.querySelector("#grid-rect");
  if (gridRect) gridRect.style.display = project.settings.showGrid ? "block" : "none";
}

function renderToolState() {
  document.querySelectorAll("[data-tool]").forEach(button => {
    button.classList.toggle("active", button.dataset.tool === tool);
  });
  const hint = document.querySelector("#canvas-hint");
  if (hint) {
    hint.textContent = TOOL_HINTS[tool] || "";
    hint.classList.add("visible");
    clearTimeout(renderToolState.hintTimer);
    renderToolState.hintTimer = setTimeout(() => hint.classList.remove("visible"), 3200);
  }
}

function renderAll() {
  renderCanvas();
  renderInspector();
  renderFloorTabs();
  renderStatus();
  renderToolState();
  updateHistoryButtons();
}

function renderEditor() {
  shell.innerHTML = `
    <div class="editor" id="editor">
      <header class="topbar">
        <div class="topbar-left">
          <a class="home-link" href="index.html" aria-label="Voltar aos projetos" title="Projetos">${icon("back")}</a>
          <span class="mini-brand">F</span>
          <div class="project-title-wrap">
            <input class="project-title-input" id="project-title" value="${escapeHtml(project.name)}" maxlength="80" aria-label="Nome do projeto">
            <span class="save-state" id="save-state">Salvo neste navegador</span>
          </div>
        </div>

        <div class="topbar-center">
          <div class="view-switch" aria-label="Modo de visualização">
            <button class="active" type="button">2D</button>
            <button type="button" disabled title="Visualização 3D será adicionada depois">3D</button>
          </div>
        </div>

        <div class="topbar-right">
          <button class="top-button" type="button" data-action="undo" title="Desfazer (Ctrl+Z)">${icon("undo")}</button>
          <button class="top-button" type="button" data-action="redo" title="Refazer (Ctrl+Y)">${icon("redo")}</button>
          <button class="top-button" type="button" data-action="fit" title="Enquadrar planta">${icon("fit")}</button>
          <button class="top-button primary" type="button" data-action="open-export">${icon("export")}<span class="button-label">Exportar</span></button>
          <button class="top-button mobile-inspector" type="button" data-action="toggle-inspector" title="Propriedades">${icon("inspector")}</button>
        </div>
      </header>

      <nav class="tool-rail" aria-label="Ferramentas de desenho">
        <button class="tool-button active" type="button" data-tool="select" data-tooltip="Selecionar (V)">${icon("select")}</button>
        <div class="tool-divider"></div>
        <button class="tool-button" type="button" data-tool="wall" data-tooltip="Parede (W)">${icon("wall")}</button>
        <button class="tool-button" type="button" data-tool="room" data-tooltip="Cômodo (R)">${icon("room")}</button>
        <button class="tool-button" type="button" data-tool="door" data-tooltip="Porta (D)">${icon("door")}</button>
        <button class="tool-button" type="button" data-tool="window" data-tooltip="Janela (N)">${icon("window")}</button>
        <div class="tool-divider"></div>
        <button class="tool-button" type="button" data-tool="measure" data-tooltip="Medida (M)">${icon("measure")}</button>
        <button class="tool-button" type="button" data-tool="text" data-tooltip="Texto (T)">${icon("text")}</button>
        <div class="tool-spacer"></div>
        <button class="tool-button" type="button" data-tool="pan" data-tooltip="Mover prancheta (H)">${icon("hand")}</button>
      </nav>

      <main class="canvas-region">
        <svg id="plan-svg" data-tool="select" xmlns="http://www.w3.org/2000/svg" aria-label="Prancheta de planta baixa">
          <defs>
            <pattern id="small-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#ece8e5" stroke-width="0.7"/>
            </pattern>
            <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <rect width="100" height="100" fill="url(#small-grid)"/>
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#ddd7d3" stroke-width="1.1"/>
            </pattern>
          </defs>
          <g id="viewport">
            <rect id="grid-rect" x="-50000" y="-50000" width="100000" height="100000" fill="url(#grid)"/>
            <g id="object-layer"></g>
            <g id="overlay-layer"></g>
          </g>
        </svg>
        <div class="canvas-hint" id="canvas-hint"></div>
        <div class="floor-tabs" id="floor-tabs" aria-label="Pavimentos"></div>
        <div class="zoom-controls" aria-label="Zoom">
          <button class="zoom-button" type="button" data-action="zoom-out" aria-label="Diminuir zoom">−</button>
          <span class="zoom-value" id="zoom-value">78%</span>
          <button class="zoom-button" type="button" data-action="zoom-in" aria-label="Aumentar zoom">＋</button>
        </div>
      </main>

      <aside class="inspector" id="inspector">
        <div class="inspector-header" id="inspector-header"></div>
        <div class="inspector-body" id="inspector-body"></div>
      </aside>

      <footer class="statusbar">
        <div class="status-left">
          <span id="status-area">Área: 0 m²</span>
          <span id="status-walls">0 paredes</span>
        </div>
        <div class="status-right">
          <label class="status-toggle"><input id="snap-toggle" type="checkbox" checked> Encaixe</label>
          <label class="status-toggle"><input id="grid-toggle" type="checkbox" checked> Grade</label>
          <span>1 quadrado = 1 m</span>
        </div>
      </footer>
    </div>

    <div class="context-menu" id="context-menu" hidden>
      <button type="button" data-action="duplicate-selection">Duplicar</button>
      <button class="danger" type="button" data-action="delete-selection">Excluir</button>
    </div>

    <div class="modal-backdrop" id="export-modal" hidden>
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <h2 id="export-title">Exportar projeto</h2>
        <p>O arquivo do Atero Floor mantém o projeto editável. SVG e PNG geram uma prancha do pavimento atual.</p>
        <div class="inspector-actions">
          <button class="inspector-button" type="button" data-export="project">Projeto editável (.json)</button>
          <button class="inspector-button" type="button" data-export="svg">Planta vetorial (.svg)</button>
          <button class="inspector-button" type="button" data-export="png">Imagem em alta resolução (.png)</button>
        </div>
        <div class="modal-actions">
          <button class="small-button" type="button" data-action="close-export">Fechar</button>
        </div>
      </section>
    </div>

    <div class="toast-stack" aria-live="polite"></div>
  `;
}

function setTool(nextTool, libraryItem = null) {
  tool = nextTool;
  activeLibraryItem = libraryItem;
  draft = null;
  hoveredPoint = null;
  if (nextTool !== "select") selection = null;
  renderAll();
}

function selectEntity(id) {
  selection = id ? { id } : null;
  renderAll();
}

function addWall(start, end, continueChain = true) {
  if (distance(start, end) < 0.05) return;
  commitChange(() => {
    activeFloor().walls.push({
      id: createId("wall"),
      type: "wall",
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      thickness: 0.15,
      height: activeFloor().ceilingHeight || 2.8,
      material: "Alvenaria"
    });
  });
  draft = continueChain ? { type: "wall", start: end } : null;
  hoveredPoint = end;
  renderCanvas();
}

function addMeasurement(start, end) {
  if (distance(start, end) < 0.03) return;
  commitChange(() => {
    activeFloor().measurements.push({
      id: createId("measurement"),
      type: "measurement",
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y
    });
  });
  draft = null;
  setTool("select");
}

function addRoom(start, end) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  if (width < 0.3 || height < 0.3) return;

  const roomName = prompt("Nome do cômodo:", "Novo ambiente")?.trim() || "Novo ambiente";
  commitChange(() => {
    const floor = activeFloor();
    floor.rooms.push({
      id: createId("room"),
      type: "room",
      name: roomName,
      x,
      y,
      width,
      height,
      fill: "#f8ece8"
    });

    const wallData = [
      [x, y, x + width, y],
      [x + width, y, x + width, y + height],
      [x + width, y + height, x, y + height],
      [x, y + height, x, y]
    ];
    wallData.forEach(([x1, y1, x2, y2]) => floor.walls.push({
      id: createId("wall"),
      type: "wall",
      x1, y1, x2, y2,
      thickness: 0.15,
      height: floor.ceilingHeight || 2.8,
      material: "Alvenaria"
    }));
  });
  setTool("select");
}

function addOpening(type, point) {
  const nearest = nearestWall(point, 0.3 / Math.max(view.scale, 0.5));
  if (!nearest) {
    toast("Clique mais perto de uma parede.");
    return;
  }

  commitChange(() => {
    activeFloor().openings.push({
      id: createId(type),
      type,
      wallId: nearest.wall.id,
      offset: nearest.offset,
      width: type === "door" ? 0.8 : 1.2,
      height: type === "door" ? 2.1 : 1.2,
      sill: type === "window" ? 1 : 0,
      swing: "left"
    });
  });
}

function addLabel(point) {
  const text = prompt("Texto da anotação:", "Anotação")?.trim();
  if (!text) return;
  commitChange(() => {
    activeFloor().labels.push({ id: createId("label"), type: "label", text, x: point.x, y: point.y, size: 16 });
  });
  setTool("select");
}

function addLibraryItem(point) {
  if (!activeLibraryItem) return;
  commitChange(() => {
    activeFloor().items.push({
      id: createId("item"),
      type: "item",
      kind: activeLibraryItem.kind,
      name: activeLibraryItem.name,
      x: point.x - activeLibraryItem.width / 2,
      y: point.y - activeLibraryItem.depth / 2,
      width: activeLibraryItem.width,
      depth: activeLibraryItem.depth,
      rotation: 0
    });
  });
  setTool("select");
}

function removeSelection() {
  const entity = findEntity(selection?.id);
  const list = findEntityList(selection?.id);
  if (!entity || !list) return;

  commitChange(() => {
    const index = list.findIndex(item => item.id === entity.id);
    if (index >= 0) list.splice(index, 1);
    if (entity.type === "wall") {
      activeFloor().openings = activeFloor().openings.filter(opening => opening.wallId !== entity.id);
    }
    selection = null;
  });
}

function duplicateSelection() {
  const entity = findEntity(selection?.id);
  const list = findEntityList(selection?.id);
  if (!entity || !list) return;

  commitChange(() => {
    const copyEntity = clone(entity);
    copyEntity.id = createId(entity.type);

    if (entity.type === "wall" || entity.type === "measurement") {
      copyEntity.x1 += 0.3;
      copyEntity.y1 += 0.3;
      copyEntity.x2 += 0.3;
      copyEntity.y2 += 0.3;
    } else if (entity.type === "door" || entity.type === "window") {
      copyEntity.offset = Math.min(0.95, entity.offset + 0.12);
    } else {
      copyEntity.x += 0.3;
      copyEntity.y += 0.3;
    }

    list.push(copyEntity);
    selection = { id: copyEntity.id };
  });
}

function updateProperty(key, rawValue) {
  const entity = findEntity(selection?.id);
  const floor = activeFloor();

  if (key.startsWith("floor.")) {
    const property = key.split(".")[1];
    const value = property === "name" ? String(rawValue).trim() || floor.name : Number(rawValue);
    commitChange(() => { floor[property] = value; });
    return;
  }

  if (!entity) return;
  let value = rawValue;
  const textProperties = new Set(["name", "material", "text", "fill", "swing"]);
  if (!textProperties.has(key)) value = Number(rawValue);

  commitChange(() => {
    if (entity.type === "wall" && key === "length") {
      const currentLength = wallLength(entity);
      if (currentLength > 0 && value > 0) {
        const ratio = value / currentLength;
        entity.x2 = entity.x1 + (entity.x2 - entity.x1) * ratio;
        entity.y2 = entity.y1 + (entity.y2 - entity.y1) * ratio;
      }
    } else {
      entity[key] = value;
    }
  });
}

function entityDragUpdate(entity, current, start, original) {
  const dx = current.x - start.x;
  const dy = current.y - start.y;

  if (entity.type === "wall" || entity.type === "measurement") {
    entity.x1 = original.x1 + dx;
    entity.y1 = original.y1 + dy;
    entity.x2 = original.x2 + dx;
    entity.y2 = original.y2 + dy;
  } else if (entity.type === "door" || entity.type === "window") {
    const wall = activeFloor().walls.find(item => item.id === entity.wallId);
    if (wall) entity.offset = projectPointToWall(current, wall).offset;
  } else {
    entity.x = original.x + dx;
    entity.y = original.y + dy;
  }
}

function beginEntityDrag(event, entity, handle = null) {
  const current = snappedPoint(svgPoint(event));
  drag = {
    kind: handle ? "handle" : "entity",
    pointerId: event.pointerId,
    start: current,
    original: clone(entity),
    entityId: entity.id,
    handle,
    before: serializeProject(),
    moved: false
  };
  document.querySelector("#plan-svg").setPointerCapture(event.pointerId);
}

function moveDrag(event) {
  if (!drag || drag.kind === "pan") return;
  const entity = findEntity(drag.entityId);
  if (!entity) return;
  const current = snappedPoint(svgPoint(event));
  drag.moved = drag.moved || distance(current, drag.start) > 0.01;

  if (drag.kind === "handle") {
    if (drag.handle === "start") {
      entity.x1 = current.x;
      entity.y1 = current.y;
    } else {
      entity.x2 = current.x;
      entity.y2 = current.y;
    }
  } else {
    entityDragUpdate(entity, current, drag.start, drag.original);
  }

  renderCanvas();
  renderInspector();
  renderStatus();
}

function endDrag() {
  if (!drag) return;
  if (drag.kind !== "pan" && drag.moved) {
    recordHistory(drag.before);
    queueSave();
  }
  drag = null;
  renderAll();
}

function beginPan(event) {
  drag = {
    kind: "pan",
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
    startX: view.x,
    startY: view.y
  };
  const svg = document.querySelector("#plan-svg");
  svg.dataset.panning = "true";
  svg.setPointerCapture(event.pointerId);
}

function movePan(event) {
  view.x = drag.startX + (event.clientX - drag.clientX);
  view.y = drag.startY + (event.clientY - drag.clientY);
  renderCanvas();
}

function zoomAt(factor, clientX = null, clientY = null) {
  const svg = document.querySelector("#plan-svg");
  const rect = svg.getBoundingClientRect();
  const x = clientX ?? rect.left + rect.width / 2;
  const y = clientY ?? rect.top + rect.height / 2;
  const localX = x - rect.left;
  const localY = y - rect.top;
  const oldScale = view.scale;
  const nextScale = Math.max(0.25, Math.min(3.5, oldScale * factor));
  const worldX = (localX - view.x) / oldScale;
  const worldY = (localY - view.y) / oldScale;
  view.scale = nextScale;
  view.x = localX - worldX * nextScale;
  view.y = localY - worldY * nextScale;
  renderCanvas();
}

function projectBounds() {
  const floor = activeFloor();
  const points = [];
  floor.walls.forEach(wall => points.push({ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }));
  floor.rooms.forEach(room => points.push({ x: room.x, y: room.y }, { x: room.x + room.width, y: room.y + room.height }));
  floor.items.forEach(item => points.push({ x: item.x, y: item.y }, { x: item.x + item.width, y: item.y + item.depth }));
  floor.labels.forEach(label => points.push({ x: label.x, y: label.y }));

  if (!points.length) return { minX: -2, minY: -2, maxX: 8, maxY: 6 };
  return {
    minX: Math.min(...points.map(point => point.x)),
    minY: Math.min(...points.map(point => point.y)),
    maxX: Math.max(...points.map(point => point.x)),
    maxY: Math.max(...points.map(point => point.y))
  };
}

function fitView() {
  const svg = document.querySelector("#plan-svg");
  const rect = svg.getBoundingClientRect();
  const bounds = projectBounds();
  const width = Math.max(1, (bounds.maxX - bounds.minX) * PX_PER_METER);
  const height = Math.max(1, (bounds.maxY - bounds.minY) * PX_PER_METER);
  const padding = 90;
  view.scale = Math.max(0.25, Math.min(2, Math.min((rect.width - padding * 2) / width, (rect.height - padding * 2) / height)));
  view.x = rect.width / 2 - ((bounds.minX + bounds.maxX) / 2) * PX_PER_METER * view.scale;
  view.y = rect.height / 2 - ((bounds.minY + bounds.maxY) / 2) * PX_PER_METER * view.scale;
  renderCanvas();
}

function addFloorFlow() {
  const name = prompt("Nome do novo pavimento:", `Pavimento ${project.floors.length + 1}`)?.trim();
  if (!name) return;
  const highest = Math.max(...project.floors.map(floor => Number(floor.elevation) || 0));
  commitChange(() => {
    const floor = createFloor(name, highest + 3);
    project.floors.push(floor);
    project.activeFloorId = floor.id;
    selection = null;
  });
  fitView();
}

function deleteCurrentFloor() {
  if (project.floors.length <= 1) return;
  const floor = activeFloor();
  if (!confirm(`Excluir o pavimento “${floor.name}”?`)) return;
  commitChange(() => {
    project.floors = project.floors.filter(item => item.id !== floor.id);
    project.activeFloorId = project.floors[0].id;
    selection = null;
  });
  fitView();
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "projeto";
}

function download(filename, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function cleanEntityMarkup() {
  const previousSelection = selection;
  selection = null;
  const markup = entityMarkup();
  selection = previousSelection;
  return markup;
}

function exportSvgString() {
  const bounds = projectBounds();
  const padding = 0.6;
  const minX = toPx(bounds.minX - padding);
  const minY = toPx(bounds.minY - padding);
  const width = toPx(bounds.maxX - bounds.minX + padding * 2);
  const height = toPx(bounds.maxY - bounds.minY + padding * 2);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${Math.max(width, 100)} ${Math.max(height, 100)}" width="${Math.max(width, 100)}" height="${Math.max(height, 100)}">
  <rect x="${minX}" y="${minY}" width="${Math.max(width, 100)}" height="${Math.max(height, 100)}" fill="#ffffff"/>
  <style>
    .room-shape{stroke:rgba(134,112,105,.16);stroke-width:1}.room-label{fill:#746a66;font:700 13px sans-serif;text-anchor:middle}.room-area{fill:#9a908c;font:10px sans-serif;text-anchor:middle}.wall-line{stroke:#302a28;stroke-linecap:square}.entity-hit{display:none}.opening-cut{stroke:#fff}.door-leaf{stroke:#7d6d68;fill:none;stroke-width:1.5}.window-line{stroke:#52737b;stroke-width:2}.furniture-shape{fill:#f3efed;stroke:#8c807b;stroke-width:1.2}.item-label{fill:#6f6561;font:9px sans-serif;text-anchor:middle}.text-label{fill:#4e4643;font-weight:700}.measure-line{stroke:#b95e4e;stroke-width:1.2;stroke-dasharray:4 3}.measure-text{fill:#a74f42;font:700 10px sans-serif;text-anchor:middle;paint-order:stroke;stroke:#fff;stroke-width:4px}
  </style>
  ${cleanEntityMarkup()}
</svg>`;
}

async function exportPng() {
  const svg = exportSvgString();
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = url;
  });

  const maxSize = 4096;
  const scale = Math.min(2, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);

  const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, "image/png", 1));
  download(`${slugify(project.name)}-${slugify(activeFloor().name)}.png`, pngBlob, "image/png");
}

async function runExport(type) {
  saveNow();
  if (type === "project") {
    download(`${slugify(project.name)}.atero-floor.json`, exportProject(project), "application/json");
  }
  if (type === "svg") {
    download(`${slugify(project.name)}-${slugify(activeFloor().name)}.svg`, exportSvgString(), "image/svg+xml");
  }
  if (type === "png") {
    try {
      await exportPng();
    } catch (error) {
      console.error(error);
      toast("Não foi possível gerar o PNG. Tente exportar em SVG.");
      return;
    }
  }
  toast("Exportação concluída.");
  document.querySelector("#export-modal").hidden = true;
}

function hideContextMenu() {
  const menu = document.querySelector("#context-menu");
  if (menu) menu.hidden = true;
}

function handleCanvasPointerDown(event) {
  hideContextMenu();
  const svg = event.currentTarget;
  const point = snappedPoint(svgPoint(event));
  const entityElement = event.target.closest?.("[data-entity-id]");
  const handle = event.target.dataset?.handle || null;

  if (event.button === 1 || tool === "pan" || spacePressed) {
    event.preventDefault();
    beginPan(event);
    return;
  }

  if (event.button !== 0) return;

  if (tool === "select") {
    if (entityElement) {
      const entity = findEntity(entityElement.dataset.entityId);
      if (!entity) return;
      selection = { id: entity.id };
      renderAll();
      beginEntityDrag(event, entity, handle);
    } else {
      selectEntity(null);
    }
    return;
  }

  if (tool === "wall") {
    if (!draft) {
      draft = { type: "wall", start: point };
      hoveredPoint = point;
      renderCanvas();
    } else {
      addWall(draft.start, point, true);
    }
    return;
  }

  if (tool === "room") {
    draft = { type: "room", start: point };
    hoveredPoint = point;
    svg.setPointerCapture(event.pointerId);
    return;
  }

  if (tool === "measure") {
    if (!draft) {
      draft = { type: "measurement", start: point };
      hoveredPoint = point;
      renderCanvas();
    } else {
      addMeasurement(draft.start, point);
    }
    return;
  }

  if (tool === "door" || tool === "window") addOpening(tool, point);
  if (tool === "text") addLabel(point);
  if (tool === "place-item") addLibraryItem(point);
}

function handleCanvasPointerMove(event) {
  if (drag?.kind === "pan") {
    movePan(event);
    return;
  }

  if (drag) {
    moveDrag(event);
    return;
  }

  if (draft) {
    hoveredPoint = snappedPoint(svgPoint(event));
    renderCanvas();
  }
}

function handleCanvasPointerUp(event) {
  const svg = event.currentTarget;
  if (drag?.kind === "pan") {
    svg.dataset.panning = "false";
    drag = null;
    return;
  }

  if (drag) {
    endDrag();
    return;
  }

  if (tool === "room" && draft?.type === "room") {
    const end = snappedPoint(svgPoint(event));
    const start = draft.start;
    draft = null;
    hoveredPoint = null;
    addRoom(start, end);
  }
}

function handleCanvasWheel(event) {
  event.preventDefault();
  const factor = event.deltaY > 0 ? 0.9 : 1.1;
  zoomAt(factor, event.clientX, event.clientY);
}

function handleContextMenu(event) {
  event.preventDefault();
  const entityElement = event.target.closest?.("[data-entity-id]");
  if (!entityElement) return;
  selection = { id: entityElement.dataset.entityId };
  renderAll();
  const menu = document.querySelector("#context-menu");
  menu.style.left = `${Math.min(event.clientX, innerWidth - 190)}px`;
  menu.style.top = `${Math.min(event.clientY, innerHeight - 110)}px`;
  menu.hidden = false;
}

function handleAction(action) {
  if (action === "undo") undo();
  if (action === "redo") redo();
  if (action === "fit") fitView();
  if (action === "zoom-in") zoomAt(1.15);
  if (action === "zoom-out") zoomAt(0.87);
  if (action === "delete-selection") removeSelection();
  if (action === "duplicate-selection") duplicateSelection();
  if (action === "add-floor") addFloorFlow();
  if (action === "delete-floor") deleteCurrentFloor();
  if (action === "open-export") document.querySelector("#export-modal").hidden = false;
  if (action === "close-export") document.querySelector("#export-modal").hidden = true;
  if (action === "toggle-inspector") document.querySelector("#editor").classList.toggle("inspector-open");
  hideContextMenu();
}

function bindEvents() {
  const svg = document.querySelector("#plan-svg");
  svg.addEventListener("pointerdown", handleCanvasPointerDown);
  svg.addEventListener("pointermove", handleCanvasPointerMove);
  svg.addEventListener("pointerup", handleCanvasPointerUp);
  svg.addEventListener("pointercancel", () => { drag = null; draft = null; renderAll(); });
  svg.addEventListener("wheel", handleCanvasWheel, { passive: false });
  svg.addEventListener("contextmenu", handleContextMenu);

  shell.addEventListener("click", event => {
    const toolButton = event.target.closest("[data-tool]");
    if (toolButton) {
      setTool(toolButton.dataset.tool);
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (actionButton) {
      handleAction(actionButton.dataset.action);
      return;
    }

    const floorButton = event.target.closest("[data-floor-id]");
    if (floorButton) {
      project.activeFloorId = floorButton.dataset.floorId;
      selection = null;
      draft = null;
      queueSave();
      renderAll();
      fitView();
      return;
    }

    const libraryButton = event.target.closest("[data-library-kind]");
    if (libraryButton) {
      const item = LIBRARY.find(entry => entry.kind === libraryButton.dataset.libraryKind);
      if (item) setTool("place-item", item);
      return;
    }

    const exportButton = event.target.closest("[data-export]");
    if (exportButton) runExport(exportButton.dataset.export);
  });

  shell.addEventListener("change", event => {
    if (event.target.matches("[data-property]")) {
      updateProperty(event.target.dataset.property, event.target.value);
    }

    if (event.target.id === "snap-toggle") {
      project.settings.snap = event.target.checked;
      queueSave();
    }

    if (event.target.id === "grid-toggle") {
      project.settings.showGrid = event.target.checked;
      queueSave();
      renderStatus();
    }
  });

  const titleInput = document.querySelector("#project-title");
  titleInput.addEventListener("change", () => {
    const name = titleInput.value.trim() || project.name;
    project.name = name;
    titleInput.value = name;
    queueSave();
    document.title = `${name} | Atero Floor`;
  });

  document.addEventListener("pointerdown", event => {
    if (!event.target.closest("#context-menu")) hideContextMenu();
  });

  document.addEventListener("keydown", event => {
    const typing = event.target.matches("input, textarea, select, [contenteditable='true']");
    if (event.code === "Space" && !typing) {
      spacePressed = true;
      event.preventDefault();
    }

    if (typing) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "y") {
      event.preventDefault();
      redo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "s") {
      event.preventDefault();
      saveNow();
      toast("Projeto salvo neste navegador.");
      return;
    }

    const shortcuts = { v: "select", w: "wall", r: "room", d: "door", n: "window", m: "measure", t: "text", h: "pan" };
    if (shortcuts[key]) setTool(shortcuts[key]);

    if (event.key === "Delete" || event.key === "Backspace") removeSelection();
    if (event.key === "Escape") {
      draft = null;
      hoveredPoint = null;
      setTool("select");
      document.querySelector("#export-modal").hidden = true;
    }
  });

  document.addEventListener("keyup", event => {
    if (event.code === "Space") spacePressed = false;
  });

  window.addEventListener("beforeunload", saveNow);
  window.addEventListener("resize", () => renderCanvas());
}

export async function startEditor({ user }) {
  currentUser = user;
  const projectId = new URLSearchParams(location.search).get("project");
  project = getProject(projectId);

  if (!project) {
    location.replace("index.html");
    return;
  }

  if (!project.activeFloorId || !project.floors.some(floor => floor.id === project.activeFloorId)) {
    project.activeFloorId = project.floors[0]?.id;
  }

  renderEditor();
  bindEvents();
  renderAll();
  document.title = `${project.name} | Atero Floor`;
  requestAnimationFrame(fitView);
}
