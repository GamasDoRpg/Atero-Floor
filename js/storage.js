const STORAGE_KEY = "atero-floor-projects-v1";
const CURRENT_VERSION = 1;

export function createId(prefix = "item") {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function now() {
  return new Date().toISOString();
}

function emptyFloor(name = "Térreo") {
  return {
    id: createId("floor"),
    name,
    elevation: 0,
    ceilingHeight: 2.8,
    walls: [],
    openings: [],
    rooms: [],
    items: [],
    labels: [],
    measurements: []
  };
}

function wall(x1, y1, x2, y2, thickness = 0.15) {
  return {
    id: createId("wall"),
    type: "wall",
    x1,
    y1,
    x2,
    y2,
    thickness,
    height: 2.8,
    material: "Alvenaria"
  };
}

function opening(type, wallId, offset, width) {
  return {
    id: createId(type),
    type,
    wallId,
    offset,
    width,
    height: type === "door" ? 2.1 : 1.2,
    sill: type === "window" ? 1 : 0,
    swing: "left"
  };
}

function room(name, x, y, width, height, fill = "#f7e7e2") {
  return {
    id: createId("room"),
    type: "room",
    name,
    x,
    y,
    width,
    height,
    fill
  };
}

function item(kind, name, x, y, width, depth, rotation = 0) {
  return {
    id: createId("item"),
    type: "item",
    kind,
    name,
    x,
    y,
    width,
    depth,
    rotation
  };
}

function applyTemplate(floor, template) {
  if (template === "studio") {
    const walls = [
      wall(0, 0, 8, 0, 0.2),
      wall(8, 0, 8, 6, 0.2),
      wall(8, 6, 0, 6, 0.2),
      wall(0, 6, 0, 0, 0.2),
      wall(5, 0, 5, 3.2),
      wall(5, 3.2, 8, 3.2),
      wall(0, 4.2, 3.1, 4.2)
    ];

    floor.walls.push(...walls);
    floor.openings.push(
      opening("door", walls[0].id, 0.12, 0.9),
      opening("door", walls[4].id, 0.67, 0.8),
      opening("window", walls[2].id, 0.32, 1.8),
      opening("window", walls[3].id, 0.45, 1.4)
    );
    floor.rooms.push(
      room("Estar e cozinha", 0.1, 0.1, 4.8, 4, "#f8ece8"),
      room("Quarto", 5.1, 0.1, 2.8, 3, "#f3eee8"),
      room("Banheiro", 5.1, 3.3, 2.8, 2.6, "#e8f2f3"),
      room("Entrada", 0.1, 4.3, 2.9, 1.6, "#f5f2eb")
    );
    floor.items.push(
      item("sofa", "Sofá", 1.1, 1.2, 2.1, 0.9),
      item("bed", "Cama de casal", 5.35, 0.75, 2.1, 1.6),
      item("table", "Mesa", 1.2, 3.05, 1.4, 0.8)
    );
  }

  if (template === "house") {
    const walls = [
      wall(0, 0, 11, 0, 0.2),
      wall(11, 0, 11, 8, 0.2),
      wall(11, 8, 0, 8, 0.2),
      wall(0, 8, 0, 0, 0.2),
      wall(6.4, 0, 6.4, 8),
      wall(6.4, 3.4, 11, 3.4),
      wall(6.4, 5.8, 11, 5.8),
      wall(0, 5, 6.4, 5)
    ];

    floor.walls.push(...walls);
    floor.openings.push(
      opening("door", walls[0].id, 0.18, 1),
      opening("door", walls[4].id, 0.32, 0.8),
      opening("door", walls[4].id, 0.72, 0.8),
      opening("door", walls[5].id, 0.5, 0.8),
      opening("door", walls[6].id, 0.5, 0.8),
      opening("window", walls[2].id, 0.23, 2),
      opening("window", walls[2].id, 0.76, 1.5),
      opening("window", walls[1].id, 0.24, 1.6)
    );
    floor.rooms.push(
      room("Sala e cozinha", 0.1, 0.1, 6.2, 4.8, "#f8ece8"),
      room("Garagem", 0.1, 5.1, 6.2, 2.8, "#eeeeeb"),
      room("Quarto", 6.5, 0.1, 4.4, 3.2, "#f4eee8"),
      room("Banheiro", 6.5, 3.5, 4.4, 2.2, "#e8f2f3"),
      room("Escritório", 6.5, 5.9, 4.4, 2, "#eef0f5")
    );
  }
}

export function createProject({ name = "Projeto sem título", template = "blank" } = {}) {
  const createdAt = now();
  const floor = emptyFloor();
  applyTemplate(floor, template);

  return {
    id: createId("project"),
    version: CURRENT_VERSION,
    name: name.trim() || "Projeto sem título",
    createdAt,
    updatedAt: createdAt,
    activeFloorId: floor.id,
    settings: {
      unit: "m",
      gridSize: 0.1,
      snap: true,
      showGrid: true
    },
    floors: [floor]
  };
}

export function createFloor(name = "Novo pavimento", elevation = 0) {
  const floor = emptyFloor(name);
  floor.elevation = elevation;
  return floor;
}

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Não foi possível ler os projetos do Atero Floor.", error);
    return [];
  }
}

function writeAll(projects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function listProjects() {
  return readAll().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function getProject(projectId) {
  return readAll().find(project => project.id === projectId) || null;
}

export function saveProject(project) {
  const projects = readAll();
  const normalized = structuredClone(project);
  normalized.updatedAt = now();
  normalized.version = CURRENT_VERSION;

  const index = projects.findIndex(item => item.id === normalized.id);
  if (index >= 0) projects[index] = normalized;
  else projects.push(normalized);

  writeAll(projects);
  return normalized;
}

export function deleteProject(projectId) {
  writeAll(readAll().filter(project => project.id !== projectId));
}

export function duplicateProject(projectId) {
  const source = getProject(projectId);
  if (!source) return null;

  const copy = structuredClone(source);
  const createdAt = now();
  copy.id = createId("project");
  copy.name = `${source.name} — cópia`;
  copy.createdAt = createdAt;
  copy.updatedAt = createdAt;

  const idMap = new Map();
  copy.floors.forEach(floor => {
    const oldFloorId = floor.id;
    floor.id = createId("floor");
    idMap.set(oldFloorId, floor.id);

    ["walls", "openings", "rooms", "items", "labels", "measurements"].forEach(key => {
      floor[key].forEach(entity => {
        const oldId = entity.id;
        entity.id = createId(entity.type || key.slice(0, -1));
        idMap.set(oldId, entity.id);
      });
    });
  });

  copy.floors.forEach(floor => {
    floor.openings.forEach(entity => {
      entity.wallId = idMap.get(entity.wallId) || entity.wallId;
    });
  });
  copy.activeFloorId = idMap.get(source.activeFloorId) || copy.floors[0]?.id;

  return saveProject(copy);
}

export function renameProject(projectId, name) {
  const project = getProject(projectId);
  if (!project) return null;
  project.name = name.trim() || project.name;
  return saveProject(project);
}

export function exportProject(project) {
  return JSON.stringify({
    format: "atero-floor",
    version: CURRENT_VERSION,
    exportedAt: now(),
    project
  }, null, 2);
}

export function importProject(text) {
  const parsed = JSON.parse(text);
  const source = parsed?.format === "atero-floor" ? parsed.project : parsed;

  if (!source || !Array.isArray(source.floors) || !source.name) {
    throw new Error("O arquivo não contém um projeto válido do Atero Floor.");
  }

  const project = structuredClone(source);
  const createdAt = now();
  project.id = createId("project");
  project.name = `${project.name} — importado`;
  project.createdAt = createdAt;
  project.updatedAt = createdAt;
  project.version = CURRENT_VERSION;
  return saveProject(project);
}
