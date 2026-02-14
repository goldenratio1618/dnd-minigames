const GAME_ID = "echoing-mines";
const GAME_NAME = "Echoing Mines";
const DEFAULT_WIDTH = 18;
const DEFAULT_HEIGHT = 12;
const START_SIZE = 3;
const MONSTER_SPEED_TPS = 1.5;
const VIOLET_MIN_SPEED = 0.5;
const VIOLET_MAX_SPEED = 6;
const VIOLET_FAR_DISTANCE = 12;

const { solveBlockPuzzle } = require("./echoing-mines-solver");

const MONSTER_TYPES = ["green", "yellow", "red", "violet"];

const DEFAULT_GATE_CONFIG = {
  oneWay: 2,
  twoWay: 1,
  toggle: 1,
  switchback: 1,
  shared: 0,
  buffer: 0,
  chain: 1,
  interlock: 1,
  doorWall: 0,
};

const SOLUTION_FIRST_LEFT_MARGIN = 5;
const SOLUTION_FIRST_TOP_MARGIN = 6;
const SOLUTION_FIRST_GADGET_WIDTH = 9;
const SOLUTION_FIRST_GADGET_GAP = 2;
const SOLUTION_FIRST_ROW_GAP = 6;
const SOLUTION_FIRST_MODULES_PER_ROW = 3;
const SOLUTION_FIRST_MAX_ATTEMPTS = 28;

const DIRECTIONS = [
  { name: "up", dx: 0, dy: -1 },
  { name: "down", dx: 0, dy: 1 },
  { name: "left", dx: -1, dy: 0 },
  { name: "right", dx: 1, dy: 0 },
];

const OPPOSITE_DIRECTION = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const TRAP_MESSAGES = [
  "A rune flares and your pulse slows.",
  "A needle trap bites with icy venom.",
  "The floor drops for a heartbeat, then locks again.",
  "A choking hiss fills the corridor.",
  "Chains snap from the walls without warning.",
  "A sigil detonates in a flash of heat.",
];

const MONSTER_HIT_MESSAGES = {
  green: "A green skitterer slams into the party!",
  yellow: "A yellow brute barrels through the dark!",
  red: "A red hunter cuts a straight line to blood!",
  violet: "A violet stalker steps from the shadows!",
};

const DEFAULT_MONSTER_CONFIG = {
  green: { avatar: "/monsters/green-construct.png", initiativeMod: 0 },
  yellow: { avatar: "/monsters/yellow-construct.png", initiativeMod: 0 },
  red: { avatar: "/monsters/red-undead.png", initiativeMod: 0 },
  violet: { avatar: "/monsters/violet-beast.png", initiativeMod: 0 },
};

const DIRECTION_NAMES = DIRECTIONS.map((dir) => dir.name);
const CLOCKWISE_ROTATION_ORDER = ["up", "right", "down", "left"];
const VALID_ROTATION_DEGREES = new Set([0, 90, 180, 270]);

const MANA_THEMES = ["white", "blue", "black", "green"];
const MANA_THEME_TO_ROTATION = {
  white: 0,
  blue: 90,
  black: 180,
  green: 270,
};
const MANA_BUTTON_TILE_TYPES = {
  white: "mana-button-white",
  blue: "mana-button-blue",
  black: "mana-button-black",
  green: "mana-button-green",
};
const MANA_BUTTON_TYPE_TO_THEME = Object.entries(MANA_BUTTON_TILE_TYPES).reduce(
  (acc, [theme, type]) => {
    acc[type] = theme;
    return acc;
  },
  {}
);

function normalizeBlockDirections(directions) {
  const set = new Set(Array.isArray(directions) ? directions : []);
  return DIRECTION_NAMES.filter((name) => set.has(name));
}

function createBlockTile(directions, options = {}) {
  const uncovered = Boolean(options.uncovered);
  const baseDirections = normalizeBlockDirections(
    Array.isArray(options.baseDirections) && options.baseDirections.length > 0
      ? options.baseDirections
      : directions
  );
  const currentDirections = normalizeBlockDirections(
    Array.isArray(directions) && directions.length > 0 ? directions : baseDirections
  );
  return {
    type: "block",
    uncovered,
    directions: currentDirections.length > 0 ? currentDirections : baseDirections,
    baseDirections,
  };
}

function isManaButtonTileType(type) {
  return typeof type === "string" && Boolean(MANA_BUTTON_TYPE_TO_THEME[type]);
}

function getManaThemeForTile(tile) {
  if (!tile || typeof tile.type !== "string") {
    return null;
  }
  return MANA_BUTTON_TYPE_TO_THEME[tile.type] || null;
}

function normalizeManaTheme(theme) {
  return MANA_THEMES.includes(theme) ? theme : "white";
}

function normalizeRotationDegrees(degrees) {
  const parsed = Number.parseInt(degrees, 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  const normalized = ((parsed % 360) + 360) % 360;
  if (VALID_ROTATION_DEGREES.has(normalized)) {
    return normalized;
  }
  return 0;
}

function rotationStepsFromDegrees(degrees) {
  return normalizeRotationDegrees(degrees) / 90;
}

function rotateDirectionClockwise(direction, steps) {
  const index = CLOCKWISE_ROTATION_ORDER.indexOf(direction);
  if (index === -1) {
    return direction;
  }
  const normalizedSteps = ((steps % 4) + 4) % 4;
  return CLOCKWISE_ROTATION_ORDER[(index + normalizedSteps) % 4];
}

function applySingleDirectionRotation(state, degrees) {
  const normalizedDegrees = normalizeRotationDegrees(degrees);
  const steps = rotationStepsFromDegrees(normalizedDegrees);
  state.singleArrowRotation = normalizedDegrees;
  state.tiles.forEach((row) => {
    row.forEach((tile) => {
      if (!tile || tile.type !== "block") {
        return;
      }
      const baseDirections = normalizeBlockDirections(
        Array.isArray(tile.baseDirections) && tile.baseDirections.length > 0
          ? tile.baseDirections
          : tile.directions
      );
      tile.baseDirections = baseDirections;
      if (baseDirections.length === 1) {
        tile.directions = [rotateDirectionClockwise(baseDirections[0], steps)];
      } else {
        tile.directions = baseDirections.slice();
      }
    });
  });
}

function applyManaThemeState(state, theme) {
  const previousTheme = normalizeManaTheme(state.manaTheme);
  const previousRotation = normalizeRotationDegrees(state.singleArrowRotation);
  const nextTheme = normalizeManaTheme(theme);
  const nextRotation = MANA_THEME_TO_ROTATION[nextTheme];
  state.manaTheme = nextTheme;
  applySingleDirectionRotation(state, nextRotation);
  return {
    theme: nextTheme,
    changed: previousTheme !== nextTheme || previousRotation !== nextRotation,
  };
}

function createManaButtonTile(theme, options = {}) {
  const uncovered = Boolean(options.uncovered);
  const normalizedTheme = normalizeManaTheme(theme);
  return {
    type: MANA_BUTTON_TILE_TYPES[normalizedTheme],
    uncovered,
  };
}

function mapHasManaButtons(tiles) {
  for (let y = 0; y < tiles.length; y += 1) {
    for (let x = 0; x < tiles[y].length; x += 1) {
      if (isManaButtonTileType(tiles[y][x].type)) {
        return true;
      }
    }
  }
  return false;
}

function normalizeMonsterConfig(config) {
  const normalized = {};
  MONSTER_TYPES.forEach((type) => {
    const entry = config && config[type] ? config[type] : DEFAULT_MONSTER_CONFIG[type] || {};
    normalized[type] = {
      avatar: typeof entry.avatar === "string" ? entry.avatar : "",
      initiativeMod: Number.isFinite(entry.initiativeMod) ? entry.initiativeMod : 0,
    };
  });
  return normalized;
}

function normalizeTokenItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, 12);
}

function createRng(seed) {
  let value = Number.isInteger(seed) ? seed : 42;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function shuffle(array, rng) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function normalizeGateConfig(config) {
  const normalized = { ...DEFAULT_GATE_CONFIG };
  if (!config) {
    return normalized;
  }
  Object.keys(normalized).forEach((key) => {
    const value = Number.parseInt(config[key], 10);
    if (Number.isFinite(value) && value >= 0) {
      normalized[key] = value;
    }
  });
  return normalized;
}

function inBounds(x, y, width, height) {
  return x >= 0 && x < width && y >= 0 && y < height;
}

function coordKey(x, y) {
  return `${x},${y}`;
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function rollDice(rng, count, sides) {
  let total = 0;
  for (let i = 0; i < count; i += 1) {
    total += randInt(rng, 1, sides);
  }
  return total;
}

function createEmptyTile() {
  return { type: "empty", uncovered: false };
}

function createRockTile() {
  return { type: "rock", uncovered: false };
}

function buildGrid(width, height, defaultFactory) {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => defaultFactory())
  );
}

function isStartArea(x, y, startArea) {
  return (
    x >= startArea.x &&
    x < startArea.x + startArea.size &&
    y >= startArea.y &&
    y < startArea.y + startArea.size
  );
}

function carveRect(tiles, rect, makeTile) {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      tiles[y][x] = makeTile();
    }
  }
}

function carvePath(tiles, path) {
  path.forEach((pos) => {
    tiles[pos.y][pos.x] = createEmptyTile();
  });
}

function buildPath(start, exit, width, height, rng) {
  const path = [start];
  const visited = new Set([coordKey(start.x, start.y)]);
  let current = { ...start };
  let previousDir = null;
  const maxSteps = width * height * 3;
  let steps = 0;

  while (!(current.x === exit.x && current.y === exit.y) && steps < maxSteps) {
    steps += 1;
    const options = shuffle([...DIRECTIONS], rng).filter((dir) => {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      return inBounds(nx, ny, width - 1, height - 1) && nx > 0 && ny > 0;
    });
    options.sort((a, b) => {
      const aNext = { x: current.x + a.dx, y: current.y + a.dy };
      const bNext = { x: current.x + b.dx, y: current.y + b.dy };
      return manhattan(aNext, exit) - manhattan(bNext, exit);
    });

    let pick = null;
    if (rng() < 0.65) {
      pick = options[0];
    } else {
      pick = options[Math.floor(rng() * options.length)];
    }

    if (previousDir && pick && previousDir.dx === -pick.dx && previousDir.dy === -pick.dy) {
      pick = options.find(
        (dir) => dir.dx !== -previousDir.dx || dir.dy !== -previousDir.dy
      ) || pick;
    }

    if (!pick) {
      break;
    }

    const next = { x: current.x + pick.dx, y: current.y + pick.dy };
    const key = coordKey(next.x, next.y);
    if (visited.has(key)) {
      const fallback = options.find((dir) => {
        const fx = current.x + dir.dx;
        const fy = current.y + dir.dy;
        return !visited.has(coordKey(fx, fy));
      });
      if (fallback) {
        pick = fallback;
      }
    }

    current = { x: current.x + pick.dx, y: current.y + pick.dy };
    path.push({ ...current });
    visited.add(coordKey(current.x, current.y));
    previousDir = pick;
  }

  if (!(current.x === exit.x && current.y === exit.y)) {
    const fallback = [];
    let fx = start.x;
    let fy = start.y;
    fallback.push({ x: fx, y: fy });
    while (fx !== exit.x) {
      fx += fx < exit.x ? 1 : -1;
      fallback.push({ x: fx, y: fy });
    }
    while (fy !== exit.y) {
      fy += fy < exit.y ? 1 : -1;
      fallback.push({ x: fx, y: fy });
    }
    return fallback;
  }

  return path;
}

function buildRooms({
  tiles,
  width,
  height,
  rng,
  count,
  startArea,
  exit,
  mainPath,
}) {
  const rooms = [];
  const pathSet = new Set(mainPath.map((pos) => coordKey(pos.x, pos.y)));
  let attempts = count * 5;

  while (rooms.length < count && attempts > 0) {
    attempts -= 1;
    const roomWidth = randInt(rng, 3, 5);
    const roomHeight = randInt(rng, 3, 5);
    const roomX = randInt(rng, 1, width - roomWidth - 1);
    const roomY = randInt(rng, 1, height - roomHeight - 1);
    const rect = { x: roomX, y: roomY, width: roomWidth, height: roomHeight };

    let overlaps = false;
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        if (isStartArea(x, y, startArea) || (x === exit.x && y === exit.y)) {
          overlaps = true;
          break;
        }
        if (pathSet.has(coordKey(x, y))) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) {
        break;
      }
    }

    if (overlaps) {
      continue;
    }

    carveRect(tiles, rect, createEmptyTile);
    const cells = [];
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        cells.push({ x, y });
      }
    }
    rooms.push({ rect, cells });
  }

  rooms.forEach((room) => {
    const anchor = room.cells[randInt(rng, 0, room.cells.length - 1)];
    let nearest = mainPath[0];
    let bestDist = manhattan(anchor, nearest);
    mainPath.forEach((pos) => {
      const dist = manhattan(anchor, pos);
      if (dist < bestDist) {
        bestDist = dist;
        nearest = pos;
      }
    });

    let cx = anchor.x;
    let cy = anchor.y;
    while (cx !== nearest.x) {
      cx += cx < nearest.x ? 1 : -1;
      tiles[cy][cx] = createEmptyTile();
    }
    while (cy !== nearest.y) {
      cy += cy < nearest.y ? 1 : -1;
      tiles[cy][cx] = createEmptyTile();
    }
  });

  return rooms;
}

function countOpenTiles(tiles) {
  let total = 0;
  tiles.forEach((row) => {
    row.forEach((tile) => {
      if (tile.type !== "rock") {
        total += 1;
      }
    });
  });
  return total;
}

function carveOpenArea({ tiles, width, height, rng, startArea, targetRatio }) {
  const openCells = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (tiles[y][x].type !== "rock") {
        openCells.push({ x, y });
      }
    }
  }
  let openCount = countOpenTiles(tiles);
  const target = Math.min(width * height - 1, Math.floor(width * height * targetRatio));
  let attempts = width * height * 6;

  while (openCount < target && attempts > 0) {
    attempts -= 1;
    if (openCells.length === 0) {
      break;
    }
    const anchor = openCells[randInt(rng, 0, openCells.length - 1)];
    const dir = DIRECTIONS[randInt(rng, 0, DIRECTIONS.length - 1)];
    const nx = anchor.x + dir.dx;
    const ny = anchor.y + dir.dy;
    if (!inBounds(nx, ny, width, height)) {
      continue;
    }
    if (nx === 0 || ny === 0 || nx === width - 1 || ny === height - 1) {
      continue;
    }
    if (isStartArea(nx, ny, startArea)) {
      continue;
    }
    if (tiles[ny][nx].type !== "rock") {
      continue;
    }
    tiles[ny][nx] = createEmptyTile();
    openCells.push({ x: nx, y: ny });
    openCount += 1;

    if (openCount < target && rng() < 0.25) {
      const nnx = nx + dir.dx;
      const nny = ny + dir.dy;
      if (
        inBounds(nnx, nny, width, height) &&
        nnx > 0 &&
        nny > 0 &&
        nnx < width - 1 &&
        nny < height - 1 &&
        !isStartArea(nnx, nny, startArea) &&
        tiles[nny][nnx].type === "rock"
      ) {
        tiles[nny][nnx] = createEmptyTile();
        openCells.push({ x: nnx, y: nny });
        openCount += 1;
      }
    }
  }
}

function computeTrapAdjacency(tiles, width, height) {
  const counts = buildGrid(width, height, () => 0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (tiles[y][x].type !== "trap") {
        continue;
      }
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (ox === 0 && oy === 0) {
            continue;
          }
          const nx = x + ox;
          const ny = y + oy;
          if (inBounds(nx, ny, width, height)) {
            counts[ny][nx] += 1;
          }
        }
      }
    }
  }
  return counts;
}

function computeTrapDangerMask(tiles, width, height) {
  const mask = buildGrid(width, height, () => false);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (tiles[y][x].type !== "trap") {
        continue;
      }
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const nx = x + ox;
          const ny = y + oy;
          if (inBounds(nx, ny, width, height)) {
            mask[ny][nx] = true;
          }
        }
      }
    }
  }
  return mask;
}

function getTokenStartPositions(startArea, count) {
  const positions = [];
  for (let y = startArea.y; y < startArea.y + startArea.size; y += 1) {
    for (let x = startArea.x; x < startArea.x + startArea.size; x += 1) {
      positions.push({ x, y });
    }
  }
  return positions.slice(0, count);
}

function chooseTreasureValue(rng, distance, maxDistance) {
  const ratio = maxDistance === 0 ? 0 : distance / maxDistance;
  if (ratio < 0.33) {
    return rollDice(rng, 1, 10);
  }
  if (ratio < 0.66) {
    return rollDice(rng, 2, 12);
  }
  return rollDice(rng, 3, 20);
}

function generateBaseLayout({ level, seed, width, height }) {
  const rng = createRng(seed + level * 997);
  const tiles = buildGrid(width, height, createRockTile);
  const startArea = { x: 1, y: 1, size: START_SIZE };
  const startCenter = { x: startArea.x + 1, y: startArea.y + 1 };
  const exit = { x: width - 2, y: height - 2 };

  carveRect(tiles, { x: startArea.x, y: startArea.y, width: START_SIZE, height: START_SIZE }, () => ({
    type: "empty",
    uncovered: true,
  }));

  const mainPath = buildPath(startCenter, exit, width, height, rng);
  carvePath(tiles, mainPath);

  const pathDirections = new Map();
  for (let i = 0; i < mainPath.length - 1; i += 1) {
    const from = mainPath[i];
    const to = mainPath[i + 1];
    const dir = DIRECTIONS.find(
      (step) => step.dx === to.x - from.x && step.dy === to.y - from.y
    );
    if (dir) {
      pathDirections.set(coordKey(from.x, from.y), dir.name);
    }
  }

  const rooms = buildRooms({
    tiles,
    width,
    height,
    rng,
    count: Math.min(5 + Math.floor(level * 0.8), 10),
    startArea,
    exit,
    mainPath,
  });

  const targetOpenRatio = Math.min(0.62 + level * 0.02, 0.78);
  carveOpenArea({ tiles, width, height, rng, startArea, targetRatio: targetOpenRatio });

  tiles[exit.y][exit.x] = { type: "exit", uncovered: false };

  const pathSet = new Set(mainPath.map((pos) => coordKey(pos.x, pos.y)));
  const blockTargets = mainPath.filter(
    (pos) =>
      !isStartArea(pos.x, pos.y, startArea) &&
      !(pos.x === exit.x && pos.y === exit.y) &&
      manhattan(pos, exit) > 1
  );
  shuffle(blockTargets, rng);

  const areaScale = Math.sqrt(
    (width * height) / (DEFAULT_WIDTH * DEFAULT_HEIGHT)
  );
  const extraBlockTargets = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (tiles[y][x].type !== "empty") {
        continue;
      }
      if (pathSet.has(coordKey(x, y))) {
        continue;
      }
      if (isStartArea(x, y, startArea)) {
        continue;
      }
      if (rng() < 0.08) {
        extraBlockTargets.push({ x, y });
      }
    }
  }
  shuffle(extraBlockTargets, rng);
  const allTargets = blockTargets.concat(extraBlockTargets);
  const baseBlockTarget = Math.max(
    12 * level,
    Math.floor(width * height * 0.15),
    Math.floor((10 + level * 6) * areaScale)
  );
  const blockCount = Math.min(allTargets.length, baseBlockTarget);

  const blocks = [];

  for (const pos of allTargets) {
    if (blocks.length >= blockCount) {
      break;
    }
    if (tiles[pos.y][pos.x].type !== "empty") {
      continue;
    }
    const pocketDirs = shuffle([...DIRECTIONS], rng).filter((dir) => {
      const nx = pos.x + dir.dx;
      const ny = pos.y + dir.dy;
      if (!inBounds(nx, ny, width, height)) {
        return false;
      }
      if (isStartArea(nx, ny, startArea)) {
        return false;
      }
      if (pathSet.has(coordKey(nx, ny))) {
        return false;
      }
      const tile = tiles[ny][nx];
      return tile.type !== "exit";
    });
    if (pocketDirs.length === 0) {
      continue;
    }
    const pocket = pocketDirs[0];
    const pocketX = pos.x + pocket.dx;
    const pocketY = pos.y + pocket.dy;
    tiles[pocketY][pocketX] = createEmptyTile();

    let directions = [pocket.name];
    const pathDir = pathDirections.get(coordKey(pos.x, pos.y));
    const oppositeDir = pathDir ? OPPOSITE_DIRECTION[pathDir] : null;
    if (oppositeDir && rng() < 0.65) {
      directions.push(oppositeDir);
    }
    if (pathDir && rng() < 0.35) {
      directions.push(pathDir);
    }

    const styleRoll = rng();
    if (styleRoll < 0.15) {
      directions = ["up", "down", "left", "right"];
    } else if (styleRoll < 0.35) {
      if (pocket.name === "left" || pocket.name === "right") {
        directions = ["left", "right"];
      } else {
        directions = ["up", "down"];
      }
    }
    directions = normalizeBlockDirections(directions);

    tiles[pos.y][pos.x] = createBlockTile(directions, { uncovered: false });
    blocks.push({ x: pos.x, y: pos.y });
  }

  return {
    tiles,
    width,
    height,
    startArea,
    startCenter,
    exit,
    rooms,
    mainPath,
    pathSet,
    rng,
  };
}

function populateLevelFeatures(base, { level, usedSquares }) {
  const {
    tiles,
    width,
    height,
    startArea,
    startCenter,
    exit,
    rooms,
    rng,
  } = base;
  const reserved = usedSquares || new Set();

  const trapCandidates = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const key = coordKey(x, y);
      if (isStartArea(x, y, startArea)) {
        continue;
      }
      if (reserved.has(key)) {
        continue;
      }
      if (tiles[y][x].type !== "empty") {
        continue;
      }
      if (manhattan({ x, y }, startCenter) <= 2) {
        continue;
      }
      trapCandidates.push({ x, y });
    }
  }
  shuffle(trapCandidates, rng);
  const trapBase = 3 + Math.floor(Math.sqrt(level) * 3);
  const areaScale = Math.sqrt(
    (width * height) / (DEFAULT_WIDTH * DEFAULT_HEIGHT)
  );
  const trapCount = Math.min(
    trapCandidates.length,
    Math.floor(trapBase * areaScale)
  );
  for (let i = 0; i < trapCount; i += 1) {
    const pos = trapCandidates[i];
    tiles[pos.y][pos.x] = {
      type: "trap",
      uncovered: false,
      message: TRAP_MESSAGES[randInt(rng, 0, TRAP_MESSAGES.length - 1)],
    };
  }

  const roomTreasures = new Map();
  rooms.forEach((room, index) => {
    roomTreasures.set(index, []);
  });

  const treasureCandidates = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (tiles[y][x].type !== "empty") {
        continue;
      }
      treasureCandidates.push({ x, y });
    }
  }
  shuffle(treasureCandidates, rng);

  const maxDistance = manhattan(startCenter, exit);
  const baseTreasureCount = Math.min(treasureCandidates.length, 4 + level * 2);
  let placedTreasure = 0;

  rooms.forEach((room, index) => {
    if (placedTreasure >= baseTreasureCount) {
      return;
    }
    const spot = room.cells.find(
      (cell) => tiles[cell.y][cell.x].type === "empty"
    );
    if (!spot) {
      return;
    }
    const value = chooseTreasureValue(rng, manhattan(startCenter, spot), maxDistance);
    tiles[spot.y][spot.x] = {
      type: "treasure",
      uncovered: false,
      value,
    };
    roomTreasures.get(index).push({ ...spot });
    placedTreasure += 1;
  });

  for (const pos of treasureCandidates) {
    if (placedTreasure >= baseTreasureCount) {
      break;
    }
    if (tiles[pos.y][pos.x].type !== "empty") {
      continue;
    }
    const value = chooseTreasureValue(rng, manhattan(startCenter, pos), maxDistance);
    tiles[pos.y][pos.x] = {
      type: "treasure",
      uncovered: false,
      value,
    };
    placedTreasure += 1;
  }

  const monsterCounts = {
    green: 1 + Math.floor(level / 3),
    yellow: level >= 2 ? 1 + Math.floor((level - 1) / 4) : 0,
    red: level >= 3 ? 1 + Math.floor((level - 2) / 4) : 0,
    violet: level >= 4 ? 1 + Math.floor((level - 3) / 5) : 0,
  };

  const monsters = [];
  const monsterCandidates = [];
  const reachable = new Set();
  const queue = [];
  for (let y = startArea.y; y < startArea.y + startArea.size; y += 1) {
    for (let x = startArea.x; x < startArea.x + startArea.size; x += 1) {
      const key = coordKey(x, y);
      reachable.add(key);
      queue.push({ x, y });
    }
  }
  while (queue.length > 0) {
    const current = queue.shift();
    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const key = coordKey(nx, ny);
      if (!inBounds(nx, ny, width, height)) {
        continue;
      }
      if (reachable.has(key)) {
        continue;
      }
      const tile = tiles[ny][nx];
      if (tile.type === "empty" || tile.type === "treasure") {
        reachable.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const tile = tiles[y][x];
      if (tile.type !== "empty" && tile.type !== "treasure") {
        continue;
      }
      if (isStartArea(x, y, startArea)) {
        continue;
      }
      if (coordKey(x, y) === coordKey(exit.x, exit.y)) {
        continue;
      }
      if (reachable.has(coordKey(x, y))) {
        continue;
      }
      if (
        !DIRECTIONS.some((dir) => {
          const nx = x + dir.dx;
          const ny = y + dir.dy;
          return (
            inBounds(nx, ny, width, height) &&
            canMonsterMoveInto(tiles[ny][nx]) &&
            !reachable.has(coordKey(nx, ny))
          );
        })
      ) {
        continue;
      }
      monsterCandidates.push({ x, y });
    }
  }
  shuffle(monsterCandidates, rng);

  const placeMonster = (type) => {
    if (monsterCandidates.length === 0) {
      return;
    }
    const spot = monsterCandidates.pop();
    monsters.push({
      id: `m${monsters.length + 1}`,
      type,
      x: spot.x,
      y: spot.y,
      lastMoveAt: 0,
    });
  };

  Object.entries(monsterCounts).forEach(([type, count]) => {
    for (let i = 0; i < count; i += 1) {
      placeMonster(type);
    }
  });

  const roomsWithMonsters = new Set();
  rooms.forEach((room, index) => {
    if (
      room.cells.some((cell) =>
        monsters.some((monster) => monster.x === cell.x && monster.y === cell.y)
      )
    ) {
      roomsWithMonsters.add(index);
    }
  });

  roomsWithMonsters.forEach((index) => {
    const room = rooms[index];
    const extraCount = 1 + Math.floor(level / 3);
    let added = 0;
    const cells = shuffle([...room.cells], rng);
    for (const cell of cells) {
      if (added >= extraCount) {
        break;
      }
      if (tiles[cell.y][cell.x].type !== "empty") {
        continue;
      }
      const value = chooseTreasureValue(rng, manhattan(startCenter, cell), maxDistance);
      tiles[cell.y][cell.x] = {
        type: "treasure",
        uncovered: false,
        value,
      };
      added += 1;
    }
  });

  return {
    tiles,
    width,
    height,
    startArea,
    startCenter,
    exit,
    monsters,
  };
}

function carveCell(tiles, x, y, pathSet) {
  tiles[y][x] = createEmptyTile();
  if (pathSet) {
    pathSet.add(coordKey(x, y));
  }
}

function placeBlock(tiles, x, y, directions, pathSet) {
  tiles[y][x] = createBlockTile(directions, { uncovered: false });
  if (pathSet) {
    pathSet.add(coordKey(x, y));
  }
}

function carveLine(tiles, x1, y1, x2, y2, pathSet) {
  if (x1 === x2) {
    const step = y1 <= y2 ? 1 : -1;
    for (let y = y1; y !== y2 + step; y += step) {
      carveCell(tiles, x1, y, pathSet);
    }
    return;
  }
  if (y1 === y2) {
    const step = x1 <= x2 ? 1 : -1;
    for (let x = x1; x !== x2 + step; x += step) {
      carveCell(tiles, x, y1, pathSet);
    }
    return;
  }
  throw new Error("Only orthogonal lines are supported.");
}

function buildGadgetQueue(config, rng) {
  const queue = [];
  const normalized = normalizeGateConfig(config);
  Object.entries(normalized).forEach(([type, count]) => {
    if (!Number.isFinite(count) || count <= 0) {
      return;
    }
    for (let i = 0; i < count; i += 1) {
      queue.push({ type });
    }
  });
  return queue;
}

function createModuleContext({
  tiles,
  anchorX,
  laneY,
  orientation,
  pathSet,
  instance,
}) {
  const toX = (localX) =>
    orientation === 1
      ? anchorX + localX
      : anchorX + (SOLUTION_FIRST_GADGET_WIDTH - 1 - localX);
  const toY = (localY) => laneY + localY;
  const forward = orientation === 1 ? "right" : "left";
  const backward = orientation === 1 ? "left" : "right";

  return {
    forward,
    backward,
    carveCell(localX, localY = 0) {
      carveCell(tiles, toX(localX), toY(localY), pathSet);
    },
    carveLine(localX1, localY1, localX2, localY2) {
      carveLine(tiles, toX(localX1), toY(localY1), toX(localX2), toY(localY2), pathSet);
    },
    placeBlock(label, localX, localY, directions) {
      const worldX = toX(localX);
      const worldY = toY(localY);
      placeBlock(
        tiles,
        worldX,
        worldY,
        directions.slice(),
        pathSet
      );
      instance.blocks.push({ label, x: worldX, y: worldY });
    },
    mark(name, localX, localY) {
      instance.markers[name] = { x: toX(localX), y: toY(localY) };
    },
  };
}

function carveSwitchbackFrame(ctx) {
  ctx.carveLine(0, 0, 5, 0);
  ctx.carveLine(3, 0, 3, 1);
  ctx.carveLine(3, 1, 5, 1);
  ctx.carveLine(5, 1, 5, 0);
  ctx.carveLine(4, 0, 4, -1);
  ctx.carveLine(4, -1, 8, -1);
  ctx.carveLine(8, -1, 8, 0);
  ctx.mark("loopTurn", 5, 1);
  ctx.mark("upperDoor", 4, -1);
}

function carveBypassFrame(ctx) {
  ctx.carveLine(0, 0, 8, 0);
  ctx.carveLine(5, 0, 5, 1);
  ctx.carveLine(5, 1, 8, 1);
  ctx.carveLine(8, 1, 8, 0);
  ctx.mark("bypassTurn", 7, 1);
}

function applyOneWayGate(ctx, instance) {
  carveBypassFrame(ctx);
  ctx.placeBlock("primary", 5, 0, [ctx.forward]);
  instance.checks.push({ kind: "blockMoved", label: "primary" });
}

function applyTwoWayGate(ctx, instance) {
  carveBypassFrame(ctx);
  ctx.placeBlock("primary", 5, 0, [ctx.forward, ctx.backward]);
  instance.checks.push({ kind: "blockMoved", label: "primary" });
}

function applyToggleGate(ctx, instance) {
  carveBypassFrame(ctx);
  ctx.placeBlock("primary", 5, 0, [ctx.forward, ctx.backward]);
  ctx.placeBlock("toggle", 7, 1, [ctx.forward]);
  instance.checks.push({ kind: "blockMoved", label: "primary" });
  instance.checks.push({ kind: "blockMoved", label: "toggle" });
}

function applySwitchbackGate(ctx, instance) {
  carveBypassFrame(ctx);
  ctx.placeBlock("primary", 5, 0, [ctx.forward, ctx.backward]);
  ctx.placeBlock("switch", 6, 1, [ctx.forward]);
  instance.checks.push({ kind: "blockMoved", label: "primary" });
  instance.checks.push({ kind: "blockMoved", label: "switch" });
  instance.checks.push({ kind: "markerVisited", marker: "bypassTurn" });
}

function applySharedGate(ctx, instance) {
  carveBypassFrame(ctx);
  ctx.placeBlock("primary", 5, 0, [ctx.forward, ctx.backward]);
  ctx.placeBlock("shared", 6, 1, [ctx.forward]);
  instance.checks.push({ kind: "blockMoved", label: "primary" });
}

function applyBufferGate(ctx, instance) {
  carveBypassFrame(ctx);
  ctx.placeBlock("primary", 5, 0, [ctx.forward]);
  instance.checks.push({ kind: "blockMoved", label: "primary" });
}

function applyChainGate(ctx, instance) {
  carveBypassFrame(ctx);
  ctx.placeBlock("lead", 5, 0, [ctx.forward]);
  ctx.placeBlock("tail", 6, 0, [ctx.forward]);
  instance.checks.push({
    kind: "chainPush",
    minLength: 2,
    labels: ["lead", "tail"],
  });
}

function applyInterlockGate(ctx, instance) {
  carveBypassFrame(ctx);
  ctx.placeBlock("primary", 5, 0, [ctx.forward, ctx.backward]);
  ctx.placeBlock("interlock", 6, 1, [ctx.forward, ctx.backward]);
  instance.checks.push({ kind: "blockMoved", label: "primary" });
}

function applyDoorWallGate(ctx, instance) {
  carveBypassFrame(ctx);
  ctx.placeBlock("primary", 5, 0, [ctx.forward, ctx.backward]);
  instance.checks.push({ kind: "blockMoved", label: "primary" });
}

const GADGET_BUILDERS = {
  oneWay: applyOneWayGate,
  twoWay: applyTwoWayGate,
  toggle: applyToggleGate,
  switchback: applySwitchbackGate,
  shared: applySharedGate,
  buffer: applyBufferGate,
  chain: applyChainGate,
  interlock: applyInterlockGate,
  doorWall: applyDoorWallGate,
};

function buildSolutionFirstLayout({ level, seed, gateConfig }) {
  const rng = createRng(seed + level * 997);
  const queue = buildGadgetQueue(gateConfig, rng);
  const gadgetCount = queue.length;
  const rows = Math.max(1, Math.ceil(gadgetCount / SOLUTION_FIRST_MODULES_PER_ROW));
  const width = Math.max(
    DEFAULT_WIDTH,
    SOLUTION_FIRST_LEFT_MARGIN * 2 +
      SOLUTION_FIRST_MODULES_PER_ROW * SOLUTION_FIRST_GADGET_WIDTH +
      (SOLUTION_FIRST_MODULES_PER_ROW - 1) * SOLUTION_FIRST_GADGET_GAP +
      6
  );
  const height = Math.max(
    DEFAULT_HEIGHT,
    SOLUTION_FIRST_TOP_MARGIN + (rows - 1) * SOLUTION_FIRST_ROW_GAP + 10
  );
  const tiles = buildGrid(width, height, createRockTile);
  const startArea = { x: 1, y: 1, size: START_SIZE };
  const startCenter = { x: startArea.x + 1, y: startArea.y + 1 };
  const pathSet = new Set();

  carveRect(
    tiles,
    { x: startArea.x, y: startArea.y, width: START_SIZE, height: START_SIZE },
    () => ({ type: "empty", uncovered: true })
  );
  for (let y = startArea.y; y < startArea.y + START_SIZE; y += 1) {
    for (let x = startArea.x; x < startArea.x + START_SIZE; x += 1) {
      pathSet.add(coordKey(x, y));
    }
  }

  const rowStartX = SOLUTION_FIRST_LEFT_MARGIN;
  const slotSpan = SOLUTION_FIRST_GADGET_WIDTH + SOLUTION_FIRST_GADGET_GAP;
  const gadgetInstances = [];
  let cursor = { x: startCenter.x, y: startCenter.y };

  queue.forEach((gate, index) => {
    const row = Math.floor(index / SOLUTION_FIRST_MODULES_PER_ROW);
    const slot = index % SOLUTION_FIRST_MODULES_PER_ROW;
    const orientation = row % 2 === 0 ? 1 : -1;
    const laneY = SOLUTION_FIRST_TOP_MARGIN + row * SOLUTION_FIRST_ROW_GAP;
    const anchorX =
      orientation === 1
        ? rowStartX + slot * slotSpan
        : rowStartX + (SOLUTION_FIRST_MODULES_PER_ROW - 1 - slot) * slotSpan;
    const entryX = orientation === 1 ? anchorX : anchorX + SOLUTION_FIRST_GADGET_WIDTH - 1;
    const exitX = orientation === 1 ? anchorX + SOLUTION_FIRST_GADGET_WIDTH - 1 : anchorX;

    if (cursor.y !== laneY) {
      carveLine(tiles, cursor.x, cursor.y, cursor.x, laneY, pathSet);
    }
    if (cursor.x !== entryX) {
      carveLine(tiles, cursor.x, laneY, entryX, laneY, pathSet);
    }

    const instance = { type: gate.type, blocks: [], checks: [], markers: {} };
    const ctx = createModuleContext({
      tiles,
      anchorX,
      laneY,
      orientation,
      pathSet,
      instance,
    });
    const builder = GADGET_BUILDERS[gate.type] || applyOneWayGate;
    builder(ctx, instance);
    gadgetInstances.push(instance);
    cursor = { x: exitX, y: laneY };
  });

  let exit = { x: width - 2, y: height - 2 };
  if (gadgetCount === 0) {
    carveLine(tiles, cursor.x, cursor.y, cursor.x, SOLUTION_FIRST_TOP_MARGIN, pathSet);
    carveLine(
      tiles,
      cursor.x,
      SOLUTION_FIRST_TOP_MARGIN,
      exit.x,
      SOLUTION_FIRST_TOP_MARGIN,
      pathSet
    );
    carveLine(tiles, exit.x, SOLUTION_FIRST_TOP_MARGIN, exit.x, exit.y, pathSet);
  } else {
    const preferredExitY = Math.min(height - 2, cursor.y + 2);
    const preferredExitX = Math.max(1, Math.min(width - 2, cursor.x));
    exit = { x: preferredExitX, y: preferredExitY };
    if (cursor.y !== exit.y) {
      carveLine(tiles, exit.x, cursor.y, exit.x, exit.y, pathSet);
    }
  }

  tiles[exit.y][exit.x] = { type: "exit", uncovered: false };
  pathSet.add(coordKey(exit.x, exit.y));

  return {
    tiles,
    width,
    height,
    startArea,
    startCenter,
    exit,
    rooms: [],
    pathSet,
    rng,
    gadgetInstances,
  };
}

function buildBlockList(tiles) {
  const blocks = [];
  tiles.forEach((row, y) => {
    row.forEach((tile, x) => {
      if (tile.type === "block") {
        blocks.push({ x, y, directions: tile.directions || [] });
      }
    });
  });
  return blocks;
}

function directionByName(name) {
  return DIRECTIONS.find((dir) => dir.name === name) || null;
}

function checkGateRequirement(instance, check, context) {
  const {
    blockPushCounts,
    blockDirs,
    pushEvents,
    visitedCells,
    markerSteps,
  } = context;
  const getIndex = (label) => instance.blockIndexByLabel.get(label);

  if (check.kind === "blockMoved") {
    const index = getIndex(check.label);
    return Number.isFinite(index) && (blockPushCounts.get(index) || 0) > 0;
  }
  if (check.kind === "blockMovedBothWays") {
    const index = getIndex(check.label);
    if (!Number.isFinite(index)) {
      return false;
    }
    const dirs = blockDirs.get(index);
    return Boolean(dirs && dirs.has(check.dirA) && dirs.has(check.dirB));
  }
  if (check.kind === "blockMovedMinTimes") {
    const index = getIndex(check.label);
    return (
      Number.isFinite(index) &&
      (blockPushCounts.get(index) || 0) >= (check.min || 1)
    );
  }
  if (check.kind === "allLabelsMoved") {
    return check.labels.every((label) => {
      const index = getIndex(label);
      return Number.isFinite(index) && (blockPushCounts.get(index) || 0) > 0;
    });
  }
  if (check.kind === "chainPush") {
    const requiredIndices = (check.labels || [])
      .map((label) => getIndex(label))
      .filter((index) => Number.isFinite(index));
    return pushEvents.some((event) => {
      if (event.chainLength < (check.minLength || 2)) {
        return false;
      }
      return requiredIndices.every((index) => event.chainIndices.includes(index));
    });
  }
  if (check.kind === "markerVisited") {
    const marker = instance.markers[check.marker];
    return Boolean(marker && visitedCells.has(coordKey(marker.x, marker.y)));
  }
  if (check.kind === "blockMovedDirAfterMarker") {
    const index = getIndex(check.label);
    if (!Number.isFinite(index)) {
      return false;
    }
    const marker = instance.markers[check.marker];
    if (!marker) {
      return false;
    }
    const markerStep = markerSteps.get(coordKey(marker.x, marker.y));
    if (!Number.isFinite(markerStep)) {
      return false;
    }
    return pushEvents.some(
      (event) =>
        event.step > markerStep &&
        event.dir === check.dir &&
        event.chainIndices.includes(index)
    );
  }
  return false;
}

function analyzeGateInteractions({ tiles, width, startArea, solution, gadgetInstances }) {
  if (!solution || !Array.isArray(solution.moves)) {
    return { counts: {} };
  }
  const blocks = buildBlockList(tiles);
  const positions = blocks.map((block) => block.y * width + block.x);
  const blockIndexByKey = new Map();
  blocks.forEach((block, index) => {
    blockIndexByKey.set(coordKey(block.x, block.y), index);
  });

  gadgetInstances.forEach((instance) => {
    instance.blockIndexByLabel = new Map();
    instance.blocks.forEach((pos) => {
      const index = blockIndexByKey.get(coordKey(pos.x, pos.y));
      if (Number.isFinite(index)) {
        instance.blockIndexByLabel.set(pos.label, index);
      }
    });
  });

  const blockPushCounts = new Map();
  const blockDirs = new Map();
  const pushEvents = [];
  const fallbackStart = {
    x: startArea.x + 1,
    y: startArea.y + 1,
  };
  let player = solution.start || fallbackStart;
  const visitedCells = new Set([coordKey(player.x, player.y)]);
  const markerSteps = new Map([[coordKey(player.x, player.y), 0]]);

  solution.moves.forEach((move, moveIndex) => {
    const dir = directionByName(move.dir);
    if (!dir) {
      return;
    }
    const target = { x: player.x + dir.dx, y: player.y + dir.dy };
    const blockMap = new Map();
    positions.forEach((pos, index) => {
      blockMap.set(pos, index);
    });
    const targetIndex = blockMap.get(target.y * width + target.x);
    if (targetIndex !== undefined) {
      const chain = [];
      let cx = target.x;
      let cy = target.y;
      while (true) {
        const chainIndex = blockMap.get(cy * width + cx);
        if (chainIndex === undefined) {
          break;
        }
        chain.push(chainIndex);
        cx += dir.dx;
        cy += dir.dy;
      }
      pushEvents.push({
        step: moveIndex + 1,
        dir: dir.name,
        chainIndices: chain.slice(),
        chainLength: chain.length,
      });
      chain.forEach((index) => {
        positions[index] += dir.dx + dir.dy * width;
        blockPushCounts.set(index, (blockPushCounts.get(index) || 0) + 1);
        const entry = blockDirs.get(index) || new Set();
        entry.add(dir.name);
        blockDirs.set(index, entry);
      });
    }
    player = target;
    const key = coordKey(player.x, player.y);
    visitedCells.add(key);
    if (!markerSteps.has(key)) {
      markerSteps.set(key, moveIndex + 1);
    }
  });

  const counts = {};
  gadgetInstances.forEach((instance) => {
    const checks = Array.isArray(instance.checks) ? instance.checks : [];
    const passed = checks.every((check) =>
      checkGateRequirement(instance, check, {
        blockPushCounts,
        blockDirs,
        pushEvents,
        visitedCells,
        markerSteps,
      })
    );
    if (passed) {
      counts[instance.type] = (counts[instance.type] || 0) + 1;
    }
  });

  return { counts };
}

function meetsGateCounts(counts, gateConfig) {
  const normalized = normalizeGateConfig(gateConfig);
  return Object.entries(normalized).every(([type, required]) => {
    if (!required) {
      return true;
    }
    return (counts[type] || 0) >= required;
  });
}

function analyzeSolutionShape(solution) {
  if (!solution || !Array.isArray(solution.moves) || solution.moves.length === 0) {
    return {
      turns: 0,
      verticalMoves: 0,
      maxStraightRun: 0,
      maxPushRun: 0,
    };
  }

  let turns = 0;
  let verticalMoves = 0;
  let maxStraightRun = 1;
  let straightRun = 1;
  let maxPushRun = 0;
  let pushRun = 0;

  solution.moves.forEach((move, index) => {
    if (move.dir === "up" || move.dir === "down") {
      verticalMoves += 1;
    }
    if (move.push) {
      pushRun += 1;
      if (pushRun > maxPushRun) {
        maxPushRun = pushRun;
      }
    } else {
      pushRun = 0;
    }

    if (index === 0) {
      return;
    }
    const previous = solution.moves[index - 1];
    if (previous.dir !== move.dir) {
      turns += 1;
      straightRun = 1;
    } else {
      straightRun += 1;
      if (straightRun > maxStraightRun) {
        maxStraightRun = straightRun;
      }
    }
  });

  return {
    turns,
    verticalMoves,
    maxStraightRun,
    maxPushRun,
  };
}

function countMonsterReachableTiles(tiles, width, height, start) {
  const startTile = tiles[start.y][start.x];
  if (!canMonsterMoveInto(startTile)) {
    return 0;
  }
  const visited = new Set([coordKey(start.x, start.y)]);
  const queue = [{ x: start.x, y: start.y }];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      if (!inBounds(nx, ny, width, height)) {
        continue;
      }
      const key = coordKey(nx, ny);
      if (visited.has(key)) {
        continue;
      }
      const tile = tiles[ny][nx];
      if (!canMonsterMoveInto(tile)) {
        continue;
      }
      visited.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return visited.size;
}

function monstersHaveMobility(state, minTiles) {
  return state.monsters.every(
    (monster) =>
      countMonsterReachableTiles(state.tiles, state.width, state.height, monster) >= minTiles
  );
}

function generateLevel({ level, seed, width, height, gateConfig, onProgress }) {
  const normalizedGateConfig = normalizeGateConfig(gateConfig);
  const totalGates = Object.values(normalizedGateConfig).reduce(
    (sum, value) => sum + (Number.isFinite(value) ? value : 0),
    0
  );
  const minMonsterTiles = 5;
  const fullSolveLimit = Math.max(
    180000 + level * 12000,
    600000 + totalGates * 270000
  );
  const notifyProgress = typeof onProgress === "function" ? onProgress : null;
  const reportReject = (reason, extra = null) => {
    if (!notifyProgress) {
      return;
    }
    notifyProgress({
      event: "reject",
      reason,
      detail: extra,
    });
  };

  let attempts = 0;

  while (attempts < SOLUTION_FIRST_MAX_ATTEMPTS) {
    attempts += 1;
    const attemptSeed = seed + attempts * 997;
    const base = buildSolutionFirstLayout({
      level,
      seed: attemptSeed,
      gateConfig: normalizedGateConfig,
    });
    if (notifyProgress) {
      notifyProgress({
        attempt: attempts,
        width: base.width,
        height: base.height,
        seed: attemptSeed,
        sizeBoost: 0,
      });
    }

    const solution = solveBlockPuzzle({
      ...base,
      maxStates: fullSolveLimit,
    });
    if (!solution) {
      reportReject("unsolved");
      continue;
    }

    if (totalGates > 0 && solution.pushes < totalGates) {
      reportReject("tooFewPushes", { pushes: solution.pushes, required: totalGates });
      continue;
    }
    if (
      totalGates > 0 &&
      solution.distinctBlocksPushed <
        Math.max(1, Math.floor(totalGates * 0.45))
    ) {
      reportReject("tooFewDistinctBlocks", {
        distinctBlocksPushed: solution.distinctBlocksPushed,
        required: Math.max(1, Math.floor(totalGates * 0.45)),
      });
      continue;
    }

    const interaction = analyzeGateInteractions({
      tiles: base.tiles,
      width: base.width,
      height: base.height,
      startArea: base.startArea,
      solution,
      gadgetInstances: base.gadgetInstances || [],
    });
    if (!meetsGateCounts(interaction.counts, normalizedGateConfig)) {
      reportReject("gateCounts", { counts: interaction.counts });
      continue;
    }

    const shape = analyzeSolutionShape(solution);
    if (totalGates > 0) {
      const minTurns = Math.max(2, Math.ceil(totalGates * 0.5));
      const minVerticalMoves = Math.max(2, Math.ceil(totalGates * 0.35));
      const maxStraightRun = 16 + Math.floor(totalGates / 2);
      if (
        shape.turns < minTurns ||
        shape.verticalMoves < minVerticalMoves ||
        shape.maxStraightRun > maxStraightRun
      ) {
        reportReject("shape", {
          shape,
          minTurns,
          minVerticalMoves,
          maxStraightRun,
        });
        continue;
      }
    }

    const populated = populateLevelFeatures(base, {
      level,
      usedSquares: solution.usedSquares,
    });
    if (!monstersHaveMobility(populated, minMonsterTiles)) {
      reportReject("monsterMobility");
      continue;
    }

    return {
      ...populated,
      solver: {
        moves: solution.moves,
        start: solution.start,
        pushes: solution.pushes,
        unintuitivePushes: solution.unintuitivePushes,
        distinctBlocksPushed: solution.distinctBlocksPushed,
        revisitedSquares: solution.revisitedSquares,
        revisitEvents: solution.revisitEvents,
      },
      generationAttempts: attempts,
    };
  }

  const fallback = buildSolutionFirstLayout({
    level,
    seed,
    gateConfig: normalizedGateConfig,
  });
  return {
    ...fallback,
    solver: null,
    generationAttempts: attempts,
  };
}

function createTokens({ tokens, tokenCount, startArea }) {
  const positions = getTokenStartPositions(startArea, tokens ? tokens.length : tokenCount);
  if (tokens && tokens.length > 0) {
    return tokens.map((token, index) => {
      const pos = positions[index] || positions[positions.length - 1];
      return {
        id: token.id,
        name: token.name || "",
        ownerId: token.ownerId || null,
        gold: Number.isFinite(token.gold) ? token.gold : 0,
        items: normalizeTokenItems(token.items),
        avatar: token.avatar || "",
        initiativeMod: Number.isFinite(token.initiativeMod) ? token.initiativeMod : 0,
        x: pos.x,
        y: pos.y,
        lastMoveAt: 0,
        escaped: false,
      };
    });
  }

  return positions.map((pos, index) => ({
    id: `p${index + 1}`,
    name: "",
    ownerId: null,
    gold: 0,
    items: [],
    avatar: "",
    initiativeMod: 0,
    x: pos.x,
    y: pos.y,
    lastMoveAt: 0,
    escaped: false,
  }));
}

function createGame({
  level = 1,
  seed = 42,
  tokens = null,
  tokenCount = 4,
  monsterConfig = null,
  gateConfig = null,
  fogEnabled = true,
  onProgress = null,
} = {}) {
  const width = DEFAULT_WIDTH;
  const height = DEFAULT_HEIGHT;
  const generated = generateLevel({
    level,
    seed,
    width,
    height,
    gateConfig,
    onProgress,
  });
  const nextTokens = createTokens({
    tokens,
    tokenCount,
    startArea: generated.startArea,
  });
  const nextMonsterConfig = normalizeMonsterConfig(monsterConfig);

  return {
    gameId: GAME_ID,
    name: GAME_NAME,
    level,
    seed,
    width: generated.width,
    height: generated.height,
    tiles: generated.tiles,
    startArea: generated.startArea,
    exit: generated.exit,
    tokens: nextTokens,
    monsters: generated.monsters,
    monsterConfig: nextMonsterConfig,
    fogEnabled: fogEnabled !== false,
    solver: generated.solver || null,
    generationAttempts: generated.generationAttempts || 1,
    combat: null,
    pendingTrap: null,
    manaTheme: "white",
    singleArrowRotation: 0,
  };
}

function normalizeSolverSnapshot(solver) {
  if (!solver || !Array.isArray(solver.moves)) {
    return null;
  }
  const validDirections = new Set(DIRECTIONS.map((dir) => dir.name));
  const moves = solver.moves
    .map((move) => {
      if (typeof move === "string") {
        return { dir: move, push: false };
      }
      if (!move || typeof move.dir !== "string") {
        return null;
      }
      return { dir: move.dir, push: Boolean(move.push) };
    })
    .filter((move) => move && validDirections.has(move.dir));

  if (moves.length === 0) {
    return null;
  }

  const start = solver.start || {};
  const startX = Number.parseInt(start.x, 10);
  const startY = Number.parseInt(start.y, 10);

  return {
    moves,
    start: Number.isFinite(startX) && Number.isFinite(startY) ? { x: startX, y: startY } : null,
    pushes: Number.isFinite(solver.pushes) ? solver.pushes : moves.filter((move) => move.push).length,
    unintuitivePushes: Number.isFinite(solver.unintuitivePushes) ? solver.unintuitivePushes : 0,
    distinctBlocksPushed: Number.isFinite(solver.distinctBlocksPushed)
      ? solver.distinctBlocksPushed
      : 0,
    revisitedSquares: Number.isFinite(solver.revisitedSquares)
      ? solver.revisitedSquares
      : 0,
    revisitEvents: Number.isFinite(solver.revisitEvents) ? solver.revisitEvents : 0,
  };
}

function loadSnapshot(state, snapshot) {
  if (!snapshot || !Array.isArray(snapshot.tiles)) {
    return null;
  }
  const width = Number.parseInt(snapshot.width, 10);
  const height = Number.parseInt(snapshot.height, 10);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 4 || height < 4) {
    return null;
  }

  const startArea =
    snapshot.startArea &&
    Number.isFinite(snapshot.startArea.x) &&
    Number.isFinite(snapshot.startArea.y) &&
    Number.isFinite(snapshot.startArea.size)
      ? {
          x: snapshot.startArea.x,
          y: snapshot.startArea.y,
          size: snapshot.startArea.size,
        }
      : { x: 1, y: 1, size: START_SIZE };

  const exit =
    snapshot.exit &&
    Number.isFinite(snapshot.exit.x) &&
    Number.isFinite(snapshot.exit.y)
      ? { x: snapshot.exit.x, y: snapshot.exit.y }
      : { x: width - 2, y: height - 2 };

  const validDirections = new Set(DIRECTIONS.map((dir) => dir.name));
  const tiles = buildGrid(width, height, createRockTile);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = snapshot.tiles[y] && snapshot.tiles[y][x];
      if (!source || typeof source.type !== "string") {
        continue;
      }
      const uncovered = Boolean(source.uncovered);
      if (source.type === "block") {
        const directions = Array.isArray(source.directions)
          ? source.directions.filter((dir) => validDirections.has(dir))
          : [];
        const baseDirections = Array.isArray(source.baseDirections)
          ? source.baseDirections.filter((dir) => validDirections.has(dir))
          : directions;
        tiles[y][x] = createBlockTile(directions, {
          uncovered,
          baseDirections,
        });
      } else if (source.type === "trap") {
        tiles[y][x] = {
          type: "trap",
          uncovered,
          message: typeof source.message === "string" ? source.message : TRAP_MESSAGES[0],
        };
      } else if (source.type === "treasure") {
        tiles[y][x] = {
          type: "treasure",
          uncovered,
          value: Number.isFinite(source.value) ? source.value : 0,
        };
      } else if (source.type === "magic-item") {
        tiles[y][x] = {
          type: "magic-item",
          uncovered,
          itemName:
            typeof source.itemName === "string" && source.itemName.trim().length > 0
              ? source.itemName.trim()
              : "",
        };
      } else if (source.type === "exit") {
        tiles[y][x] = { type: "exit", uncovered };
      } else if (source.type === "empty") {
        tiles[y][x] = { type: "empty", uncovered };
      } else if (source.type === "rock") {
        tiles[y][x] = { type: "rock", uncovered };
      } else if (isManaButtonTileType(source.type)) {
        const theme = MANA_BUTTON_TYPE_TO_THEME[source.type] || "white";
        tiles[y][x] = createManaButtonTile(theme, { uncovered });
      }
    }
  }

  const monsters = Array.isArray(snapshot.monsters)
    ? snapshot.monsters
        .map((monster, index) => {
          const mx = Number.parseInt(monster && monster.x, 10);
          const my = Number.parseInt(monster && monster.y, 10);
          if (!Number.isFinite(mx) || !Number.isFinite(my)) {
            return null;
          }
          if (!inBounds(mx, my, width, height)) {
            return null;
          }
          const type = MONSTER_TYPES.includes(monster.type) ? monster.type : MONSTER_TYPES[0];
          return {
            id: typeof monster.id === "string" ? monster.id : `m${index + 1}`,
            type,
            x: mx,
            y: my,
            lastMoveAt: 0,
          };
        })
        .filter(Boolean)
    : [];

  const nextTokens = createTokens({
    tokens: state.tokens,
    tokenCount: state.tokens.length,
    startArea,
  });

  const solver = normalizeSolverSnapshot(snapshot.solver);

  const manaTheme = normalizeManaTheme(snapshot.manaTheme);
  const singleArrowRotation = Object.prototype.hasOwnProperty.call(
    snapshot,
    "singleArrowRotation"
  )
    ? normalizeRotationDegrees(snapshot.singleArrowRotation)
    : MANA_THEME_TO_ROTATION[manaTheme];

  const loadedState = {
    gameId: GAME_ID,
    name: GAME_NAME,
    level: Number.isFinite(Number.parseInt(snapshot.level, 10))
      ? Number.parseInt(snapshot.level, 10)
      : state.level,
    seed: Number.isFinite(Number.parseInt(snapshot.seed, 10))
      ? Number.parseInt(snapshot.seed, 10)
      : state.seed,
    width,
    height,
    tiles,
    startArea,
    exit,
    tokens: nextTokens,
    monsters,
    monsterConfig: state.monsterConfig,
    fogEnabled:
      typeof snapshot.fogEnabled === "boolean"
        ? snapshot.fogEnabled
        : state.fogEnabled !== false,
    solver,
    generationAttempts: Number.isFinite(snapshot.generationAttempts)
      ? snapshot.generationAttempts
      : 1,
    combat: null,
    pendingTrap: null,
    manaTheme,
    singleArrowRotation,
  };
  applySingleDirectionRotation(loadedState, singleArrowRotation);
  return loadedState;
}

function computeVisibility(tiles, width, height) {
  const visible = buildGrid(width, height, () => false);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!tiles[y][x].uncovered) {
        continue;
      }
      visible[y][x] = true;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const nx = x + ox;
          const ny = y + oy;
          if (inBounds(nx, ny, width, height)) {
            visible[ny][nx] = true;
          }
        }
      }
    }
  }
  return visible;
}

function rollInitiative(mod) {
  const roll = Math.floor(Math.random() * 20) + 1;
  return roll + mod;
}

function sortCombatEntries(entries) {
  return entries.sort((a, b) => {
    if (a.initiative !== b.initiative) {
      return b.initiative - a.initiative;
    }
    if ((a.mod || 0) !== (b.mod || 0)) {
      return (b.mod || 0) - (a.mod || 0);
    }
    const aPlayer = a.type === "player";
    const bPlayer = b.type === "player";
    if (aPlayer !== bPlayer) {
      return aPlayer ? -1 : 1;
    }
    return 0;
  });
}

function syncOtherMonstersEntry(state, combat) {
  if (!combat) {
    return;
  }
  const trackedMonsters = new Set(
    combat.order.filter((entry) => entry.type === "monster").map((entry) => entry.id)
  );
  const hasOtherMonsters = state.monsters.some((monster) => !trackedMonsters.has(monster.id));
  const otherIndex = combat.order.findIndex((entry) => entry.type === "other-monsters");

  if (hasOtherMonsters && otherIndex === -1) {
    combat.order.push({
      id: "other-monsters",
      type: "other-monsters",
      initiative: 0,
      mod: 0,
    });
  }

  if (!hasOtherMonsters && otherIndex !== -1) {
    combat.order.splice(otherIndex, 1);
    if (combat.currentIndex > otherIndex) {
      combat.currentIndex -= 1;
    } else if (combat.currentIndex >= combat.order.length) {
      combat.currentIndex = Math.max(0, combat.order.length - 1);
    }
  }
}

function pruneCombat(state) {
  if (!state.combat) {
    return;
  }
  const aliveMonsters = new Set(state.monsters.map((monster) => monster.id));
  const activePlayers = new Set(getActiveTokens(state).map((token) => token.id));
  state.combat.order = state.combat.order.filter(
    (entry) =>
      (entry.type !== "monster" || aliveMonsters.has(entry.id)) &&
      (entry.type !== "player" || activePlayers.has(entry.id))
  );
  if (state.combat.currentIndex >= state.combat.order.length) {
    state.combat.currentIndex = Math.max(0, state.combat.order.length - 1);
  }
  syncOtherMonstersEntry(state, state.combat);
  const hasPlayers = state.combat.order.some((entry) => entry.type === "player");
  if (state.monsters.length === 0 || !hasPlayers) {
    state.combat = null;
  }
}

function removeCombatEntry(state, entryId) {
  if (!state.combat) {
    return;
  }
  const index = state.combat.order.findIndex((entry) => entry.id === entryId);
  if (index === -1) {
    return;
  }
  state.combat.order.splice(index, 1);
  if (state.combat.currentIndex > index) {
    state.combat.currentIndex -= 1;
  } else if (state.combat.currentIndex >= state.combat.order.length) {
    state.combat.currentIndex = Math.max(0, state.combat.order.length - 1);
  }
  syncOtherMonstersEntry(state, state.combat);
  if (state.combat.order.length === 0) {
    state.combat = null;
  }
}

function buildCombatEntries(state, monster) {
  const monsterConfig = normalizeMonsterConfig(state.monsterConfig);
  const activeTokens = getActiveTokens(state);
  if (activeTokens.length === 0) {
    return [];
  }
  const entries = activeTokens.map((token) => {
    const mod = Number.isFinite(token.initiativeMod) ? token.initiativeMod : 0;
    return {
      id: token.id,
      type: "player",
      initiative: rollInitiative(mod),
      mod,
    };
  });
  const monsterMod = monsterConfig[monster.type]
    ? monsterConfig[monster.type].initiativeMod || 0
    : 0;
  entries.push({
    id: monster.id,
    type: "monster",
    monsterType: monster.type,
    initiative: rollInitiative(monsterMod),
    mod: monsterMod,
  });
  return entries;
}

function startCombat(state, monster) {
  if (state.combat && state.combat.active) {
    return false;
  }
  const order = buildCombatEntries(state, monster);
  if (order.length === 0) {
    return false;
  }
  const combat = {
    active: true,
    order,
    currentIndex: 0,
    round: 1,
    lastOtherMonstersRound: 0,
  };
  syncOtherMonstersEntry(state, combat);
  combat.order = sortCombatEntries(combat.order);
  state.combat = combat;
  return true;
}

function serializeCombat(state, role, socketId) {
  if (!state.combat || !state.combat.active) {
    return null;
  }
  const monsterConfig = normalizeMonsterConfig(state.monsterConfig);
  return {
    active: true,
    currentIndex: state.combat.currentIndex,
    round: state.combat.round,
    order: state.combat.order.map((entry) => {
      if (entry.type === "player") {
        const token = state.tokens.find((player) => player.id === entry.id);
        return {
          id: entry.id,
          type: "player",
          name: token && token.name ? token.name : "Hero",
          avatar: token ? token.avatar : "",
          initiative: entry.initiative,
          mod: entry.mod,
          ownedBySelf: token ? token.ownerId === socketId : false,
        };
      }
      if (entry.type === "monster") {
        const config = monsterConfig[entry.monsterType] || {};
        return {
          id: entry.id,
          type: "monster",
          monsterType: entry.monsterType,
          name: `${entry.monsterType} monster`,
          avatar: config.avatar || "",
          initiative: entry.initiative,
          mod: entry.mod,
        };
      }
      return {
        id: "other-monsters",
        type: "other-monsters",
        name: "Other monsters",
        initiative: entry.initiative,
        mod: entry.mod,
      };
    }),
  };
}
function serializeTile(tile, count, role, visible, uncovered, fogEnabled, forceUnknown) {
  if (role === "player" && !visible) {
    return { visible: false };
  }
  if (role === "player" && forceUnknown) {
    return {
      visible: true,
      uncovered: false,
      type: "unknown",
    };
  }
  const payload = {
    visible: true,
    uncovered,
    type: tile.type,
  };
  if (role === "player" && fogEnabled && tile.type === "trap" && !uncovered) {
    payload.type = "unknown";
  }
  if (tile.type === "block") {
    payload.directions = tile.directions || [];
    payload.baseDirections = tile.baseDirections || tile.directions || [];
  }
  if (tile.type === "treasure") {
    payload.value = role === "dm" ? tile.value : null;
  }
  if (tile.type === "magic-item") {
    if (role === "player") {
      payload.type = "treasure";
      payload.value = null;
    } else {
      payload.itemName = tile.itemName || "";
    }
  }
  if (tile.type === "trap" && role === "dm") {
    payload.message = tile.message || "";
  }
  if (tile.type === "empty" && (uncovered || role === "dm" || !fogEnabled)) {
    payload.number = count;
  } else if (tile.type === "empty" && role === "player") {
    payload.hasNumber = count > 0;
  }
  if (tile.type === "exit") {
    payload.exit = true;
  }
  return payload;
}

function serializeState(state, { role, socketId }) {
  const counts = computeTrapAdjacency(state.tiles, state.width, state.height);
  const fogEnabled = state.fogEnabled !== false;
  const maskTrapDangerForPlayers = role === "player" && !fogEnabled;
  const trapDangerMask = maskTrapDangerForPlayers
    ? computeTrapDangerMask(state.tiles, state.width, state.height)
    : null;
  const visibility =
    role === "dm" || !fogEnabled
      ? buildGrid(state.width, state.height, () => true)
      : computeVisibility(state.tiles, state.width, state.height);
  const tokens = state.tokens.map((token) => ({
    id: token.id,
    name: token.name,
    gold: token.gold,
    items: normalizeTokenItems(token.items),
    avatar: token.avatar,
    initiativeMod: token.initiativeMod,
    x: token.escaped ? null : token.x,
    y: token.escaped ? null : token.y,
    escaped: Boolean(token.escaped),
    owned: Boolean(token.ownerId),
    ownedBySelf: token.ownerId === socketId,
  }));

  const monsterConfig = normalizeMonsterConfig(state.monsterConfig);
  const monsters = state.monsters
    .map((monster) => {
      if (role === "dm") {
        const config = monsterConfig[monster.type] || {};
        return {
          id: monster.id,
          type: monster.type,
          x: monster.x,
          y: monster.y,
          avatar: config.avatar || "",
        };
      }
      if (maskTrapDangerForPlayers) {
        const config = monsterConfig[monster.type] || {};
        return {
          id: monster.id,
          type: monster.type,
          x: monster.x,
          y: monster.y,
          avatar: config.avatar || "",
        };
      }
      if (!visibility[monster.y] || !visibility[monster.y][monster.x]) {
        return null;
      }
      const config = monsterConfig[monster.type] || {};
      return {
        id: monster.id,
        type: monster.type,
        x: monster.x,
        y: monster.y,
        avatar: config.avatar || "",
      };
    })
    .filter(Boolean);

  const tiles = state.tiles.map((row, y) =>
    row.map((tile, x) => {
      const uncovered = tile.uncovered;
      const visible = visibility[y][x];
      const forceUnknown = Boolean(trapDangerMask && trapDangerMask[y] && trapDangerMask[y][x]) &&
        !uncovered &&
        tile.type !== "block" &&
        tile.type !== "rock" &&
        tile.type !== "magic-item" &&
        !isManaButtonTileType(tile.type);
      return serializeTile(tile, counts[y][x], role, visible, uncovered, fogEnabled, forceUnknown);
    })
  );

  const payload = {
    gameId: state.gameId,
    gameName: state.name,
    level: state.level,
    seed: state.seed,
    manaTheme: normalizeManaTheme(state.manaTheme),
    singleArrowRotation: normalizeRotationDegrees(state.singleArrowRotation),
    hasManaButtons: mapHasManaButtons(state.tiles),
    width: state.width,
    height: state.height,
    startArea: state.startArea,
    fogEnabled,
    tiles,
    tokens,
    monsters,
    monsterConfig: MONSTER_TYPES.reduce((acc, type) => {
      const config = monsterConfig[type] || {};
      acc[type] = {
        avatar: config.avatar || "",
        initiativeMod: role === "dm" ? config.initiativeMod || 0 : null,
      };
      return acc;
    }, {}),
    combat: serializeCombat(state, role, socketId),
    pendingTrap: state.pendingTrap
      ? role === "dm"
        ? {
            active: true,
            message: state.pendingTrap.message,
            triggeredBy: state.pendingTrap.triggeredBy,
          }
        : { active: true }
      : null,
  };
  if (role === "dm") {
    payload.generationAttempts = state.generationAttempts || 1;
    payload.solver = state.solver
      ? {
          moves: state.solver.moves,
          start: state.solver.start,
          pushes: state.solver.pushes,
          unintuitivePushes: state.solver.unintuitivePushes,
          distinctBlocksPushed: state.solver.distinctBlocksPushed,
          revisitedSquares: state.solver.revisitedSquares,
          revisitEvents: state.solver.revisitEvents,
        }
      : null;
  }
  return payload;
}

function findTokenAt(state, x, y) {
  return (
    state.tokens.find(
      (token) => !token.escaped && token.x === x && token.y === y
    ) || null
  );
}

function getActiveTokens(state) {
  return state.tokens.filter((token) => !token.escaped);
}

function findMonsterAt(state, x, y) {
  return state.monsters.find((monster) => monster.x === x && monster.y === y) || null;
}

function canMonsterMoveInto(tile) {
  return tile.type === "empty" || tile.type === "treasure" || tile.type === "magic-item";
}

function findPushDestination(state, player, dir) {
  const preferred = { x: player.x + dir.dx, y: player.y + dir.dy };
  const candidates = [preferred].concat(
    DIRECTIONS.map((step) => ({ x: player.x + step.dx, y: player.y + step.dy }))
  );
  for (const pos of candidates) {
    if (!inBounds(pos.x, pos.y, state.width, state.height)) {
      continue;
    }
    const tile = state.tiles[pos.y][pos.x];
    if (tile.type !== "empty") {
      continue;
    }
    if (findTokenAt(state, pos.x, pos.y)) {
      continue;
    }
    if (findMonsterAt(state, pos.x, pos.y)) {
      continue;
    }
    return pos;
  }
  return null;
}

function pushPlayerAway(state, player, dir) {
  const destination = findPushDestination(state, player, dir);
  if (!destination) {
    return false;
  }
  const tile = state.tiles[destination.y][destination.x];
  player.x = destination.x;
  player.y = destination.y;
  tile.uncovered = true;
  return true;
}

function tryPushBlock(state, blockPos, dir, options = {}) {
  const requireUncovered = Boolean(options.requireUncovered);
  const dryRun = Boolean(options.dryRun);
  const allowPushPlayer = Boolean(options.allowPushPlayer);
  const originTile = state.tiles[blockPos.y][blockPos.x];
  if (originTile.type !== "block") {
    return { ok: false };
  }
  if (!originTile.directions || !originTile.directions.includes(dir.name)) {
    return { ok: false, error: "That block will not move that way." };
  }

  const blocks = [];
  let cursor = { x: blockPos.x, y: blockPos.y };
  while (true) {
    const tile = state.tiles[cursor.y][cursor.x];
    if (tile.type !== "block") {
      break;
    }
    if (!tile.directions || !tile.directions.includes(dir.name)) {
      return { ok: false, error: "That block will not move that way." };
    }
    blocks.push({
      x: cursor.x,
      y: cursor.y,
      directions: tile.directions,
      baseDirections: tile.baseDirections || tile.directions,
    });
    const next = { x: cursor.x + dir.dx, y: cursor.y + dir.dy };
    if (!inBounds(next.x, next.y, state.width, state.height)) {
      return { ok: false, error: "That block cannot move there." };
    }
    cursor = next;
  }

  const startPos = cursor;
  const startTile = state.tiles[startPos.y][startPos.x];
  if (requireUncovered && !startTile.uncovered) {
    return { ok: false, error: "That block needs clear ground ahead." };
  }
  if (
    startTile.type === "rock" ||
    startTile.type === "exit" ||
    startTile.type === "trap" ||
    startTile.type === "block" ||
    isManaButtonTileType(startTile.type)
  ) {
    return { ok: false, error: "That block cannot move there." };
  }

  const blockDestUncovered = blocks.map((block) => {
    const destX = block.x + dir.dx;
    const destY = block.y + dir.dy;
    return state.tiles[destY][destX].uncovered;
  });

  let pushedPlayer = false;
  let playerToPush = null;
  const occupyingPlayer = findTokenAt(state, startPos.x, startPos.y);
  if (occupyingPlayer) {
    if (!allowPushPlayer) {
      return { ok: false, error: "That block cannot move there." };
    }
    const pushTarget = findPushDestination(state, occupyingPlayer, dir);
    if (!pushTarget) {
      return { ok: false, error: "That block cannot move there." };
    }
    pushedPlayer = true;
    playerToPush = occupyingPlayer;
  }

  const line = [];
  const lineUncovered = [];
  let emptyIndex = -1;
  let destroyIndex = -1;
  let destroyTreasure = false;
  let destroyMonster = false;

  if (playerToPush) {
    line.push({ x: startPos.x, y: startPos.y, tile: startTile, monster: null });
    lineUncovered.push(startTile.uncovered);
    emptyIndex = 0;
  } else {
    let scan = { x: startPos.x, y: startPos.y };
    while (true) {
      if (!inBounds(scan.x, scan.y, state.width, state.height)) {
        break;
      }
      const tile = state.tiles[scan.y][scan.x];
      if (
        tile.type === "rock" ||
        tile.type === "exit" ||
        tile.type === "trap" ||
        tile.type === "block" ||
        isManaButtonTileType(tile.type)
      ) {
        break;
      }
      const player = findTokenAt(state, scan.x, scan.y);
      if (player) {
        return { ok: false, error: "That block cannot move there." };
      }
      const monster = findMonsterAt(state, scan.x, scan.y);
      line.push({ x: scan.x, y: scan.y, tile, monster });
      lineUncovered.push(tile.uncovered);
      if (tile.type === "empty" && !monster) {
        emptyIndex = line.length - 1;
        break;
      }
      scan = { x: scan.x + dir.dx, y: scan.y + dir.dy };
    }
  }

  if (emptyIndex === -1) {
    for (let i = line.length - 1; i >= 0; i -= 1) {
      if (line[i].tile.type === "treasure" || line[i].tile.type === "magic-item") {
        destroyIndex = i;
        destroyTreasure = true;
        if (line[i].monster) {
          destroyMonster = true;
        }
        break;
      }
    }
    if (destroyIndex === -1) {
      for (let i = line.length - 1; i >= 0; i -= 1) {
        if (line[i].monster) {
          destroyIndex = i;
          destroyMonster = true;
          break;
        }
      }
    }
    if (destroyIndex === -1) {
      return { ok: false, error: "That block cannot move there." };
    }
    emptyIndex = destroyIndex;
  }

  const effects = {
    blockMoved: true,
    destroyedTreasure: destroyTreasure,
    destroyedMonster: destroyMonster,
  };

  if (dryRun) {
    return { ok: true, pushedPlayer };
  }

  if (playerToPush) {
    pushPlayerAway(state, playerToPush, dir);
  }

  if (destroyIndex >= 0 && destroyMonster) {
    const targetMonster = line[destroyIndex] && line[destroyIndex].monster;
    if (targetMonster) {
      state.monsters = state.monsters.filter((monster) => monster.id !== targetMonster.id);
      removeCombatEntry(state, targetMonster.id);
      if (state.combat && state.monsters.length === 0) {
        state.combat = null;
      }
    }
  }

  if (line.length > 0) {
    const occupants = line.map((entry) => ({
      treasure:
        entry.tile.type === "treasure"
          ? { type: "treasure", value: entry.tile.value }
          : entry.tile.type === "magic-item"
            ? { type: "magic-item", itemName: entry.tile.itemName || "" }
            : null,
      monster: entry.monster || null,
    }));

    if (destroyIndex >= 0) {
      if (destroyTreasure) {
        occupants[destroyIndex].treasure = null;
      }
      if (destroyMonster) {
        occupants[destroyIndex].monster = null;
      }
    }

    for (let i = emptyIndex; i >= 1; i -= 1) {
      const source = occupants[i - 1];
      const dest = line[i];
      const destUncovered = lineUncovered[i];
      if (source.treasure) {
        if (source.treasure.type === "magic-item") {
          state.tiles[dest.y][dest.x] = {
            type: "magic-item",
            uncovered: destUncovered,
            itemName: source.treasure.itemName || "",
          };
        } else {
          state.tiles[dest.y][dest.x] = {
            type: "treasure",
            uncovered: destUncovered,
            value: source.treasure.value,
          };
        }
      } else {
        state.tiles[dest.y][dest.x] = {
          type: "empty",
          uncovered: destUncovered,
        };
      }
      if (source.monster) {
        source.monster.x = dest.x;
        source.monster.y = dest.y;
      }
    }

    const startUncovered = lineUncovered[0];
    state.tiles[startPos.y][startPos.x] = {
      type: "empty",
      uncovered: startUncovered,
    };
  }

  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i];
    const destX = block.x + dir.dx;
    const destY = block.y + dir.dy;
    state.tiles[destY][destX] = createBlockTile(block.directions, {
      uncovered: blockDestUncovered[i],
      baseDirections: block.baseDirections,
    });
  }
  state.tiles[blocks[0].y][blocks[0].x] = createEmptyTile();
  state.tiles[blocks[0].y][blocks[0].x].uncovered = true;
  return { ok: true, pushedPlayer, effects };
}

function applyMove(state, move, context) {
  if (!move || !move.tokenId || !move.to) {
    return { ok: false, error: "That move is not possible." };
  }
  if (state.pendingTrap && context.role !== "dm") {
    return { ok: false, error: "A trap is active. Wait for the DM." };
  }
  const token = state.tokens.find((entry) => entry.id === move.tokenId);
  if (!token) {
    return { ok: false, error: "That token is missing." };
  }
  if (token.escaped) {
    return { ok: false, error: "That token has already reached the exit." };
  }
  if (
    context.role !== "dm" &&
    token.ownerId &&
    token.ownerId !== context.socketId
  ) {
    return { ok: false, error: "That token belongs to someone else." };
  }
  if (!token.ownerId && context.role !== "dm") {
    token.ownerId = context.socketId;
  }

  const target = move.to;
  if (!inBounds(target.x, target.y, state.width, state.height)) {
    return { ok: false, error: "That move is not possible." };
  }
  const dx = target.x - token.x;
  const dy = target.y - token.y;
  const distance = Math.abs(dx) + Math.abs(dy);
  if (distance === 0) {
    return { ok: false, error: "That move is not possible." };
  }
  if (distance !== 1 && context.role !== "dm") {
    return { ok: false, error: "Move one tile at a time." };
  }
  const allowRemoteDmMove = context.role === "dm" && distance !== 1;
  const now = context.now || Date.now();
  const sounds = [];
  let stateAlteringAction = false;

  if (findTokenAt(state, target.x, target.y)) {
    return { ok: false, error: "That space is already occupied." };
  }

  const monster = findMonsterAt(state, target.x, target.y);
  if (monster) {
    startCombat(state, monster);
    return {
      ok: true,
      announcement: MONSTER_HIT_MESSAGES[monster.type] || "A monster strikes!",
    };
  }

  let tile = state.tiles[target.y][target.x];
  const dir = distance === 1 ? DIRECTIONS.find((step) => step.dx === dx && step.dy === dy) : null;
  if (tile.type === "rock") {
    return { ok: false, error: "Solid rock blocks the way." };
  }
  if (tile.type === "block") {
    if (allowRemoteDmMove || !dir) {
      return { ok: false, error: "That block cannot move there." };
    }
    const pushed = tryPushBlock(state, { x: target.x, y: target.y }, dir, {
      requireUncovered: false,
    });
    if (!pushed.ok) {
      return { ok: false, error: pushed.error || "That block will not move." };
    }
    if (pushed.effects && pushed.effects.blockMoved) {
      stateAlteringAction = true;
      sounds.push("block-drag");
      if (pushed.effects.destroyedTreasure) {
        sounds.push("gold-break");
      }
      if (pushed.effects.destroyedMonster) {
        sounds.push("monster-howl");
      }
    }
    tile = state.tiles[target.y][target.x];
  }

  const pressedTheme = getManaThemeForTile(tile);
  if (pressedTheme) {
    token.lastMoveAt = now;
    tile.uncovered = true;
    const appliedTheme = applyManaThemeState(state, pressedTheme);
    sounds.push("flourish");
    return {
      ok: true,
      announcement: `${token.name || "A hero"} presses the ${appliedTheme.theme} sigil.`,
      sounds,
      pressedManaTheme: appliedTheme.theme,
      isStateAlteringAction: appliedTheme.changed,
    };
  }

  if (tile.type === "trap") {
    token.x = target.x;
    token.y = target.y;
    token.lastMoveAt = now;
    tile.uncovered = true;
    state.pendingTrap = {
      message: tile.message || "A trap has been triggered.",
      triggeredBy: token.name || "A hero",
    };
    return {
      ok: true,
      trapTriggered: true,
      announcement: state.pendingTrap.message,
      sounds: ["trap-explosion"],
      isStateAlteringAction: true,
    };
  }

  if (tile.type === "magic-item") {
    token.x = target.x;
    token.y = target.y;
    token.lastMoveAt = now;
    tile.uncovered = true;
    if (!Array.isArray(token.items)) {
      token.items = [];
    }
    const itemName =
      typeof tile.itemName === "string" && tile.itemName.trim().length > 0
        ? tile.itemName.trim()
        : `Item ${token.items.length + 1}`;
    token.items = normalizeTokenItems(token.items.concat(itemName));
    state.tiles[target.y][target.x] = createEmptyTile();
    state.tiles[target.y][target.x].uncovered = true;
    sounds.push("coinbag");
    return {
      ok: true,
      announcement: `${token.name || "A hero"} finds ${itemName}.`,
      sounds,
      isStateAlteringAction: false,
    };
  }

  if (tile.type === "treasure") {
    token.x = target.x;
    token.y = target.y;
    token.lastMoveAt = now;
    tile.uncovered = true;
    const gain = tile.value || 0;
    token.gold += gain;
    state.tiles[target.y][target.x] = createEmptyTile();
    state.tiles[target.y][target.x].uncovered = true;
    sounds.push("coinbag");
    return {
      ok: true,
      announcement: `${token.name || "A hero"} gains ${gain} gold.`,
      sounds,
      isStateAlteringAction: false,
    };
  }

  if (tile.type === "exit") {
    token.x = target.x;
    token.y = target.y;
    token.lastMoveAt = now;
    token.escaped = true;
    removeCombatEntry(state, token.id);
    const allEscaped =
      state.tokens.length > 0 && state.tokens.every((entry) => Boolean(entry.escaped));
    return {
      ok: true,
      reachedExit: true,
      allEscaped,
      announcement: `${token.name || "A hero"} reaches the exit.`,
      sounds,
      isStateAlteringAction: true,
    };
  }

  token.x = target.x;
  token.y = target.y;
  token.lastMoveAt = now;
  tile.uncovered = true;
  return { ok: true, sounds, isStateAlteringAction: stateAlteringAction };
}

function setTokenName(state, tokenId, name, socketId, role) {
  const token = state.tokens.find((entry) => entry.id === tokenId);
  if (!token) {
    return { ok: false, error: "That token is missing." };
  }
  if (
    role !== "dm" &&
    token.ownerId &&
    token.ownerId !== socketId
  ) {
    return { ok: false, error: "That token belongs to someone else." };
  }
  token.name = String(name || "").slice(0, 24);
  if (role !== "dm") {
    token.ownerId = socketId;
  }
  return { ok: true };
}

function setTokenAvatar(state, tokenId, avatar, socketId, role) {
  const token = state.tokens.find((entry) => entry.id === tokenId);
  if (!token) {
    return { ok: false, error: "That token is missing." };
  }
  if (role !== "dm" && token.ownerId && token.ownerId !== socketId) {
    return { ok: false, error: "That token belongs to someone else." };
  }
  const data = typeof avatar === "string" ? avatar : "";
  if (data && data.length > 150000) {
    return { ok: false, error: "That token image is too large." };
  }
  token.avatar = data;
  if (role !== "dm") {
    token.ownerId = socketId;
  }
  return { ok: true };
}

function applyMonsterMove(state, move, context) {
  if (!move || !move.monsterId || !move.to) {
    return { ok: false, error: "That move is not possible." };
  }
  if (context.role !== "dm") {
    return { ok: false, error: "Only the DM can move monsters." };
  }
  const monster = state.monsters.find((entry) => entry.id === move.monsterId);
  if (!monster) {
    return { ok: false, error: "That monster is missing." };
  }

  const target = move.to;
  if (!inBounds(target.x, target.y, state.width, state.height)) {
    return { ok: false, error: "That move is not possible." };
  }
  const dx = target.x - monster.x;
  const dy = target.y - monster.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) {
    return { ok: false, error: "Move one tile at a time." };
  }
  if (findMonsterAt(state, target.x, target.y)) {
    return { ok: false, error: "That space is already occupied." };
  }

  const dir = DIRECTIONS.find((step) => step.dx === dx && step.dy === dy);
  let tile = state.tiles[target.y][target.x];
  if (tile.type === "rock" || tile.type === "exit" || isManaButtonTileType(tile.type)) {
    return { ok: false, error: "That move is not possible." };
  }

  const sounds = [];

  if (tile.type === "block") {
    const pushed = tryPushBlock(state, { x: target.x, y: target.y }, dir, {
      requireUncovered: false,
    });
    if (!pushed.ok) {
      return { ok: false, error: pushed.error || "That block will not move." };
    }
    if (pushed.effects && pushed.effects.blockMoved) {
      sounds.push("block-drag");
      if (pushed.effects.destroyedTreasure) {
        sounds.push("gold-break");
      }
      if (pushed.effects.destroyedMonster) {
        sounds.push("monster-howl");
      }
    }
    tile = state.tiles[target.y][target.x];
  }

  const player = findTokenAt(state, target.x, target.y);
  if (player) {
    pushPlayerAway(state, player, dir);
    startCombat(state, monster);
    sounds.push("monster-roar");
    return {
      ok: true,
      announcement: MONSTER_HIT_MESSAGES[monster.type] || "A monster strikes!",
      sounds,
    };
  }

  monster.x = target.x;
  monster.y = target.y;
  return { ok: true, sounds };
}

function nextMonsterId(state) {
  let maxId = 0;
  state.monsters.forEach((monster) => {
    if (typeof monster.id !== "string") {
      return;
    }
    const match = monster.id.match(/^m(\d+)$/);
    if (!match) {
      return;
    }
    const value = Number.parseInt(match[1], 10);
    if (Number.isFinite(value) && value > maxId) {
      maxId = value;
    }
  });
  return `m${maxId + 1}`;
}

function removeMonsterAt(state, x, y) {
  const index = state.monsters.findIndex((monster) => monster.x === x && monster.y === y);
  if (index === -1) {
    return false;
  }
  const [removed] = state.monsters.splice(index, 1);
  if (removed && removed.id) {
    removeCombatEntry(state, removed.id);
  }
  if (state.monsters.length === 0) {
    state.combat = null;
  }
  return true;
}

function findFallbackExit(state, avoidX, avoidY) {
  for (let y = state.height - 2; y >= 1; y -= 1) {
    for (let x = state.width - 2; x >= 1; x -= 1) {
      if (x === avoidX && y === avoidY) {
        continue;
      }
      if (findTokenAt(state, x, y) || findMonsterAt(state, x, y)) {
        continue;
      }
      const tile = state.tiles[y][x];
      if (tile.type === "empty" || tile.type === "treasure" || tile.type === "magic-item") {
        return { x, y };
      }
    }
  }
  return null;
}

function setFogOfWar(state, enabled, role) {
  if (role !== "dm") {
    return { ok: false, error: "Only the DM can toggle fog of war." };
  }
  state.fogEnabled = enabled !== false;
  return { ok: true };
}

function nextMagicItemName(state) {
  let maxIndex = 0;
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const tile = state.tiles[y][x];
      if (!tile || tile.type !== "magic-item") {
        continue;
      }
      const match =
        typeof tile.itemName === "string" ? tile.itemName.match(/item\s+(\d+)/i) : null;
      if (!match) {
        continue;
      }
      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value) && value > maxIndex) {
        maxIndex = value;
      }
    }
  }
  return `Item ${maxIndex + 1}`;
}

function editMapTile(state, payload, role) {
  if (role !== "dm") {
    return { ok: false, error: "Only the DM can edit the map." };
  }
  const x = Number.parseInt(payload && payload.x, 10);
  const y = Number.parseInt(payload && payload.y, 10);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !inBounds(x, y, state.width, state.height)) {
    return { ok: false, error: "That tile is out of bounds." };
  }
  if (findTokenAt(state, x, y)) {
    return { ok: false, error: "Cannot edit a tile occupied by a player token." };
  }

  const mode = payload && payload.mode;
  if (mode === "erase-monster") {
    removeMonsterAt(state, x, y);
    state.solver = null;
    return { ok: true };
  }

  if (mode === "monster") {
    const type = payload && payload.monsterType;
    if (!MONSTER_TYPES.includes(type)) {
      return { ok: false, error: "Unknown monster type." };
    }
    const tile = state.tiles[y][x];
    if (!canMonsterMoveInto(tile)) {
      return { ok: false, error: "Monsters must be placed on empty or treasure tiles." };
    }
    const existing = findMonsterAt(state, x, y);
    if (existing) {
      existing.type = type;
      existing.lastMoveAt = 0;
    } else {
      state.monsters.push({
        id: nextMonsterId(state),
        type,
        x,
        y,
        lastMoveAt: 0,
      });
    }
    state.solver = null;
    return { ok: true };
  }

  if (mode !== "tile") {
    return { ok: false, error: "Unknown edit mode." };
  }

  const tileType = payload && payload.tileType;
  const validTileTypes = new Set([
    "rock",
    "empty",
    "block",
    "trap",
    "treasure",
    "magic-item",
    "exit",
    MANA_BUTTON_TILE_TYPES.white,
    MANA_BUTTON_TILE_TYPES.blue,
    MANA_BUTTON_TILE_TYPES.black,
    MANA_BUTTON_TILE_TYPES.green,
  ]);
  if (!validTileTypes.has(tileType)) {
    return { ok: false, error: "Unknown tile type." };
  }

  if (tileType === "exit") {
    const previousExit = state.exit;
    if (previousExit && inBounds(previousExit.x, previousExit.y, state.width, state.height)) {
      const prevTile = state.tiles[previousExit.y][previousExit.x];
      if (prevTile && prevTile.type === "exit") {
        state.tiles[previousExit.y][previousExit.x] = createEmptyTile();
      }
    }
    state.tiles[y][x] = { type: "exit", uncovered: false };
    state.exit = { x, y };
    removeMonsterAt(state, x, y);
    state.solver = null;
    return { ok: true };
  }

  if (tileType === "block") {
    const validDirections = new Set(DIRECTIONS.map((dir) => dir.name));
    const baseDirections = Array.isArray(payload && payload.directions)
      ? payload.directions.filter((dir) => validDirections.has(dir))
      : [];
    if (baseDirections.length === 0) {
      return { ok: false, error: "Blocks need at least one valid push direction." };
    }
    const normalizedBase = normalizeBlockDirections(baseDirections);
    const steps = rotationStepsFromDegrees(state.singleArrowRotation);
    const rotatedDirections =
      normalizedBase.length === 1
        ? [rotateDirectionClockwise(normalizedBase[0], steps)]
        : normalizedBase;
    state.tiles[y][x] = createBlockTile(rotatedDirections, {
      uncovered: false,
      baseDirections: normalizedBase,
    });
    removeMonsterAt(state, x, y);
    state.solver = null;
    return { ok: true };
  }

  if (isManaButtonTileType(tileType)) {
    const theme = MANA_BUTTON_TYPE_TO_THEME[tileType];
    state.tiles[y][x] = createManaButtonTile(theme, { uncovered: false });
    removeMonsterAt(state, x, y);
    state.solver = null;
    return { ok: true };
  }

  if (tileType === "trap") {
    state.tiles[y][x] = {
      type: "trap",
      uncovered: false,
      message: TRAP_MESSAGES[0],
    };
    removeMonsterAt(state, x, y);
    state.solver = null;
    return { ok: true };
  }

  if (tileType === "treasure") {
    state.tiles[y][x] = {
      type: "treasure",
      uncovered: false,
      value: 10,
    };
    state.solver = null;
    return { ok: true };
  }

  if (tileType === "magic-item") {
    state.tiles[y][x] = {
      type: "magic-item",
      uncovered: false,
      itemName: nextMagicItemName(state),
    };
    state.solver = null;
    return { ok: true };
  }

  if (tileType === "rock") {
    let fallbackExit = null;
    if (state.exit && state.exit.x === x && state.exit.y === y) {
      fallbackExit = findFallbackExit(state, x, y);
      if (!fallbackExit) {
        return { ok: false, error: "Map needs at least one reachable exit tile." };
      }
    }
    state.tiles[y][x] = createRockTile();
    removeMonsterAt(state, x, y);
    if (fallbackExit) {
      state.exit = fallbackExit;
      state.tiles[state.exit.y][state.exit.x] = { type: "exit", uncovered: false };
    }
    state.solver = null;
    return { ok: true };
  }

  let fallbackExit = null;
  if (state.exit && state.exit.x === x && state.exit.y === y) {
    fallbackExit = findFallbackExit(state, x, y);
    if (!fallbackExit) {
      return { ok: false, error: "Map needs at least one reachable exit tile." };
    }
  }
  state.tiles[y][x] = createEmptyTile();
  if (fallbackExit) {
    state.exit = fallbackExit;
    state.tiles[state.exit.y][state.exit.x] = { type: "exit", uncovered: false };
  }
  state.solver = null;
  return { ok: true };
}

function setTokenInitiativeMod(state, tokenId, mod, socketId, role) {
  const token = state.tokens.find((entry) => entry.id === tokenId);
  if (!token) {
    return { ok: false, error: "That token is missing." };
  }
  if (role !== "dm" && token.ownerId && token.ownerId !== socketId) {
    return { ok: false, error: "That token belongs to someone else." };
  }
  const value = Number.parseInt(mod, 10);
  token.initiativeMod = Number.isFinite(value) ? value : 0;
  if (role !== "dm") {
    token.ownerId = socketId;
  }
  if (state.combat && state.combat.active) {
    const entry = state.combat.order.find(
      (combatEntry) => combatEntry.type === "player" && combatEntry.id === token.id
    );
    if (entry) {
      entry.mod = token.initiativeMod;
    }
  }
  return { ok: true };
}

function setMonsterConfig(state, type, config, role) {
  if (role !== "dm") {
    return { ok: false, error: "Only the DM can update monsters." };
  }
  if (!MONSTER_TYPES.includes(type)) {
    return { ok: false, error: "Unknown monster type." };
  }
  const nextConfig = normalizeMonsterConfig(state.monsterConfig);
  const current = nextConfig[type];
  if (config && typeof config.avatar === "string") {
    current.avatar = config.avatar;
  }
  if (config && Number.isFinite(Number.parseInt(config.initiativeMod, 10))) {
    current.initiativeMod = Number.parseInt(config.initiativeMod, 10);
  }
  nextConfig[type] = current;
  state.monsterConfig = nextConfig;

  if (state.combat && state.combat.active) {
    state.combat.order.forEach((entry) => {
      if (entry.type === "monster" && entry.monsterType === type) {
        entry.mod = current.initiativeMod;
      }
    });
  }
  return { ok: true };
}

function setCombatInitiative(state, entryId, initiative, socketId, role) {
  if (!state.combat || !state.combat.active) {
    return { ok: false, error: "No combat is active." };
  }
  const entry = state.combat.order.find((combatEntry) => combatEntry.id === entryId);
  if (!entry) {
    return { ok: false, error: "That combatant is missing." };
  }
  if (entry.type === "player") {
    const token = state.tokens.find((player) => player.id === entryId);
    if (role !== "dm" && token && token.ownerId && token.ownerId !== socketId) {
      return { ok: false, error: "That token belongs to someone else." };
    }
  } else if (entry.type === "monster") {
    if (role !== "dm") {
      return { ok: false, error: "Only the DM can update monsters." };
    }
  } else {
    return { ok: false, error: "That combatant cannot be edited." };
  }
  const value = Number.parseInt(initiative, 10);
  if (!Number.isFinite(value)) {
    return { ok: false, error: "Initiative must be a number." };
  }
  entry.initiative = value;
  return { ok: true };
}

function resortCombat(state, role) {
  if (!state.combat || !state.combat.active) {
    return { ok: false, error: "No combat is active." };
  }
  if (role !== "dm") {
    return { ok: false, error: "Only the DM can reorder combat." };
  }
  const currentId = state.combat.order[state.combat.currentIndex]
    ? state.combat.order[state.combat.currentIndex].id
    : null;
  syncOtherMonstersEntry(state, state.combat);
  state.combat.order = sortCombatEntries(state.combat.order);
  if (currentId) {
    const index = state.combat.order.findIndex((entry) => entry.id === currentId);
    state.combat.currentIndex = index === -1 ? 0 : index;
  }
  return { ok: true };
}

function addMonsterToCombat(state, monsterId, role) {
  if (role !== "dm") {
    return { ok: false, error: "Only the DM can add monsters." };
  }
  if (!state.combat || !state.combat.active) {
    return { ok: false, error: "No combat is active." };
  }
  const monster = state.monsters.find((entry) => entry.id === monsterId);
  if (!monster) {
    return { ok: false, error: "That monster is missing." };
  }
  if (state.combat.order.some((entry) => entry.id === monsterId)) {
    return { ok: false, error: "That monster is already in combat." };
  }
  const config = normalizeMonsterConfig(state.monsterConfig);
  const mod = config[monster.type] ? config[monster.type].initiativeMod || 0 : 0;
  state.combat.order.push({
    id: monster.id,
    type: "monster",
    monsterType: monster.type,
    initiative: rollInitiative(mod),
    mod,
  });
  syncOtherMonstersEntry(state, state.combat);
  state.combat.order = sortCombatEntries(state.combat.order);
  return { ok: true };
}

function deleteMonster(state, monsterId, role) {
  if (role !== "dm") {
    return { ok: false, error: "Only the DM can delete monsters." };
  }
  const monsterIndex = state.monsters.findIndex((monster) => monster.id === monsterId);
  if (monsterIndex === -1) {
    return { ok: false, error: "That monster is missing." };
  }
  state.monsters.splice(monsterIndex, 1);
  removeCombatEntry(state, monsterId);
  if (state.monsters.length === 0) {
    state.combat = null;
  }
  return { ok: true };
}

function exitCombat(state, role) {
  if (role !== "dm") {
    return { ok: false, error: "Only the DM can end combat." };
  }
  state.combat = null;
  return { ok: true };
}

function advanceLevel(state) {
  const nextTokens = state.tokens.map((token) => ({
    id: token.id,
    name: token.name,
    ownerId: token.ownerId,
    gold: token.gold,
    items: normalizeTokenItems(token.items),
    avatar: token.avatar,
    initiativeMod: token.initiativeMod,
  }));
  return createGame({
    level: state.level + 1,
    seed: state.seed,
    tokens: nextTokens,
    tokenCount: state.tokens.length,
    monsterConfig: state.monsterConfig,
    fogEnabled: state.fogEnabled !== false,
  });
}

function resetLevel(state) {
  const nextTokens = state.tokens.map((token) => ({
    id: token.id,
    name: token.name,
    ownerId: token.ownerId,
    gold: token.gold,
    items: normalizeTokenItems(token.items),
    avatar: token.avatar,
    initiativeMod: token.initiativeMod,
  }));
  return createGame({
    level: state.level,
    seed: state.seed,
    tokens: nextTokens,
    tokenCount: state.tokens.length,
    monsterConfig: state.monsterConfig,
    fogEnabled: state.fogEnabled !== false,
  });
}

function releaseTokenOwnership(state, socketId) {
  let changed = false;
  state.tokens.forEach((token) => {
    if (token.ownerId === socketId) {
      token.ownerId = null;
      changed = true;
    }
  });
  return changed;
}

function findShortestPath(start, targets, state) {
  const queue = [start];
  const cameFrom = new Map();
  const startKey = coordKey(start.x, start.y);
  cameFrom.set(startKey, null);
  const targetSet = new Set(targets.map((pos) => coordKey(pos.x, pos.y)));

  while (queue.length > 0) {
    const current = queue.shift();
    const key = coordKey(current.x, current.y);
    if (targetSet.has(key)) {
      const path = [];
      let cursorKey = key;
      while (cursorKey) {
        const [cx, cy] = cursorKey.split(",").map((value) => Number.parseInt(value, 10));
        path.unshift({ x: cx, y: cy });
        cursorKey = cameFrom.get(cursorKey);
      }
      return path;
    }
    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const nextKey = coordKey(nx, ny);
      if (!inBounds(nx, ny, state.width, state.height)) {
        continue;
      }
      if (cameFrom.has(nextKey)) {
        continue;
      }
      const tile = state.tiles[ny][nx];
      if (!canMonsterMoveInto(tile)) {
        continue;
      }
      cameFrom.set(nextKey, key);
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

function chooseRandomMove(state, monster, allowBlocks) {
  const options = [];
  for (const dir of DIRECTIONS) {
    const nx = monster.x + dir.dx;
    const ny = monster.y + dir.dy;
    if (!inBounds(nx, ny, state.width, state.height)) {
      continue;
    }
    const tile = state.tiles[ny][nx];
    if (canMonsterMoveInto(tile)) {
      options.push({ dir, x: nx, y: ny, pushBlock: false });
    } else if (allowBlocks && tile.type === "block") {
      const canPush = tryPushBlock(state, { x: nx, y: ny }, dir, {
        requireUncovered: false,
        allowPushPlayer: true,
        dryRun: true,
      });
      if (canPush.ok) {
        options.push({ dir, x: nx, y: ny, pushBlock: true });
      }
    }
  }
  if (options.length === 0) {
    return null;
  }
  return options[Math.floor(Math.random() * options.length)];
}

function moveMonster(state, monster, move) {
  if (!move) {
    return null;
  }
  const sounds = [];
  let pushedPlayer = false;
  if (move.pushBlock) {
    const pushed = tryPushBlock(state, { x: move.x, y: move.y }, move.dir, {
      requireUncovered: false,
      allowPushPlayer: true,
    });
    if (!pushed.ok) {
      return null;
    }
    pushedPlayer = pushed.pushedPlayer;
    if (pushed.effects && pushed.effects.blockMoved) {
      sounds.push("block-drag");
      if (pushed.effects.destroyedTreasure) {
        sounds.push("gold-break");
      }
      if (pushed.effects.destroyedMonster) {
        sounds.push("monster-howl");
      }
    }
  }
  const player = findTokenAt(state, move.x, move.y);
  if (player) {
    pushPlayerAway(state, player, move.dir);
    return {
      hit: true,
      message: MONSTER_HIT_MESSAGES[monster.type] || "A monster strikes!",
      sounds,
    };
  }
  monster.x = move.x;
  monster.y = move.y;
  if (pushedPlayer) {
    return {
      hit: true,
      message: "A yellow brute shoves a block into a hero!",
      sounds,
    };
  }
  return { hit: false, sounds };
}

function computeVioletSpeed(distance) {
  if (distance <= 1) {
    return VIOLET_MAX_SPEED;
  }
  if (distance >= VIOLET_FAR_DISTANCE) {
    return VIOLET_MIN_SPEED;
  }
  const ratio = (VIOLET_FAR_DISTANCE - distance) / (VIOLET_FAR_DISTANCE - 1);
  return VIOLET_MIN_SPEED + ratio * (VIOLET_MAX_SPEED - VIOLET_MIN_SPEED);
}

function computeMonsterMove(state, monster, timestamp) {
  let speed = MONSTER_SPEED_TPS;
  let move = null;
  const activeTokens = getActiveTokens(state);
  if (activeTokens.length === 0) {
    return { move: null, speed };
  }
  if (monster.type === "violet") {
    const path = findShortestPath(
      { x: monster.x, y: monster.y },
      activeTokens.map((token) => ({ x: token.x, y: token.y })),
      state
    );
    if (!path || path.length < 2) {
      return { move: null, speed };
    }
    const distance = path.length - 1;
    speed = computeVioletSpeed(distance);
    const next = path[1];
    const dir = DIRECTIONS.find(
      (step) => step.dx === next.x - monster.x && step.dy === next.y - monster.y
    );
    move = { x: next.x, y: next.y, dir };
  } else if (monster.type === "red") {
    let nearest = activeTokens[0];
    let bestDistance = nearest ? manhattan(monster, nearest) : Infinity;
    activeTokens.forEach((token) => {
      const dist = manhattan(monster, token);
      if (dist < bestDistance) {
        bestDistance = dist;
        nearest = token;
      }
    });
    if (!nearest) {
      return { move: null, speed };
    }
    const dx = nearest.x - monster.x;
    const dy = nearest.y - monster.y;
    let preferred = null;
    if (Math.abs(dx) >= Math.abs(dy)) {
      preferred = dx >= 0
        ? DIRECTIONS.find((d) => d.name === "right")
        : DIRECTIONS.find((d) => d.name === "left");
    } else {
      preferred = dy >= 0
        ? DIRECTIONS.find((d) => d.name === "down")
        : DIRECTIONS.find((d) => d.name === "up");
    }
    const alternatives = shuffle([...DIRECTIONS], createRng(monster.x + monster.y + timestamp));
    const checks = [preferred].concat(alternatives).filter(Boolean);
    for (const dir of checks) {
      const nx = monster.x + dir.dx;
      const ny = monster.y + dir.dy;
      if (!inBounds(nx, ny, state.width, state.height)) {
        continue;
      }
      if (canMonsterMoveInto(state.tiles[ny][nx])) {
        move = { x: nx, y: ny, dir };
        break;
      }
    }
  } else if (monster.type === "yellow") {
    move = chooseRandomMove(state, monster, true);
  } else {
    move = chooseRandomMove(state, monster, false);
  }
  return { move, speed };
}

function updateMonsters(state, { now } = {}) {
  if (state.pendingTrap) {
    return { changed: false, events: [], sounds: [] };
  }
  if (state.combat && state.combat.active) {
    return { changed: false, events: [], sounds: [] };
  }
  const timestamp = now || Date.now();
  const events = [];
  const sounds = [];
  let changed = false;

  state.monsters.forEach((monster) => {
    const { move, speed } = computeMonsterMove(state, monster, timestamp);

    if (!move) {
      return;
    }

    const interval = 1000 / speed;
    if (timestamp - monster.lastMoveAt < interval) {
      return;
    }

    const result = moveMonster(state, monster, move);
    monster.lastMoveAt = timestamp;
    if (result) {
      changed = true;
      if (result.hit) {
        events.push({ type: "announcement", message: result.message });
        sounds.push("monster-roar");
        startCombat(state, monster);
      }
      if (result.sounds && result.sounds.length > 0) {
        sounds.push(...result.sounds);
      }
    }
  });

  return { changed, events, sounds };
}

function runMonsterTurn(state, monster, { now } = {}) {
  const timestamp = now || Date.now();
  const { move } = computeMonsterMove(state, monster, timestamp);
  if (!move) {
    return { changed: false, events: [], sounds: [] };
  }
  const events = [];
  const sounds = [];
  const result = moveMonster(state, monster, move);
  if (result) {
    if (result.hit) {
      events.push({ type: "announcement", message: result.message });
      sounds.push("monster-roar");
      startCombat(state, monster);
    }
    if (result.sounds && result.sounds.length > 0) {
      sounds.push(...result.sounds);
    }
    return { changed: true, events, sounds };
  }
  return { changed: false, events, sounds };
}

function runOtherMonstersTurn(state, { now } = {}) {
  const tracked = new Set(
    state.combat
      ? state.combat.order.filter((entry) => entry.type === "monster").map((entry) => entry.id)
      : []
  );
  let changed = false;
  const events = [];
  const sounds = [];
  state.monsters.forEach((monster) => {
    if (tracked.has(monster.id)) {
      return;
    }
    const result = runMonsterTurn(state, monster, { now });
    if (result.changed) {
      changed = true;
    }
    if (result.events.length > 0) {
      events.push(...result.events);
    }
    if (result.sounds.length > 0) {
      sounds.push(...result.sounds);
    }
  });
  return { changed, events, sounds };
}

function advanceCombatTurn(state, role, { direction = 1 } = {}) {
  if (!state.combat || !state.combat.active) {
    return { ok: false, error: "No combat is active." };
  }
  if (role !== "dm") {
    return { ok: false, error: "Only the DM can advance combat." };
  }
  pruneCombat(state);
  if (!state.combat || state.combat.order.length === 0) {
    return { ok: false, error: "No combatants remain." };
  }
  if (direction !== 1 && direction !== -1) {
    direction = 1;
  }

  const combat = state.combat;
  const currentIndex = combat.currentIndex;
  let nextIndex = currentIndex + direction;
  if (nextIndex >= combat.order.length) {
    nextIndex = 0;
    combat.round += 1;
  } else if (nextIndex < 0) {
    nextIndex = combat.order.length - 1;
  }
  combat.currentIndex = nextIndex;

  const entry = combat.order[nextIndex];
  if (direction === -1) {
    return { ok: true, changed: false, events: [], sounds: [] };
  }

  if (entry.type === "monster") {
    return { ok: true, changed: false, events: [], sounds: [] };
  }

  if (entry.type === "other-monsters") {
    if (combat.lastOtherMonstersRound !== combat.round) {
      combat.lastOtherMonstersRound = combat.round;
      const result = runOtherMonstersTurn(state, { now: Date.now() });
      return { ok: true, ...result };
    }
  }

  return { ok: true, changed: false, events: [], sounds: [] };
}

module.exports = {
  GAME_ID,
  GAME_NAME,
  createGame,
  serializeState,
  applyMove,
  applyMonsterMove,
  setTokenName,
  setTokenAvatar,
  setTokenInitiativeMod,
  setFogOfWar,
  editMapTile,
  setMonsterConfig,
  setCombatInitiative,
  resortCombat,
  addMonsterToCombat,
  advanceCombatTurn,
  deleteMonster,
  exitCombat,
  advanceLevel,
  resetLevel,
  loadSnapshot,
  releaseTokenOwnership,
  updateMonsters,
};
