const GAME_ID = "echoing-mines";
const GAME_NAME = "Echoing Mines";
const DEFAULT_WIDTH = 18;
const DEFAULT_HEIGHT = 12;
const START_SIZE = 3;
const PLAYER_SPEED_TPS = 3;
const MONSTER_SPEED_TPS = 1.5;
const VIOLET_MIN_SPEED = 0.5;
const VIOLET_MAX_SPEED = 6;
const VIOLET_FAR_DISTANCE = 12;

const MONSTER_TYPES = ["green", "yellow", "red", "violet"];

const DIRECTIONS = [
  { name: "up", dx: 0, dy: -1 },
  { name: "down", dx: 0, dy: 1 },
  { name: "left", dx: -1, dy: 0 },
  { name: "right", dx: 1, dy: 0 },
];

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

function generateLevelOnce({ level, seed, width, height }) {
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
    count: Math.min(3 + Math.floor(level / 2), 6),
    startArea,
    exit,
    mainPath,
  });

  tiles[exit.y][exit.x] = { type: "exit", uncovered: false };

  const pathSet = new Set(mainPath.map((pos) => coordKey(pos.x, pos.y)));
  const blockTargets = mainPath.filter(
    (pos) =>
      !isStartArea(pos.x, pos.y, startArea) &&
      !(pos.x === exit.x && pos.y === exit.y) &&
      manhattan(pos, exit) > 1
  );
  shuffle(blockTargets, rng);

  const blockCount = Math.min(
    Math.floor(mainPath.length / 3),
    3 + Math.floor(level * 1.5)
  );

  const blocks = [];
  for (const pos of blockTargets) {
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
    if (rng() < 0.2) {
      directions = ["up", "down", "left", "right"];
    } else if (rng() < 0.35) {
      if (pocket.name === "left" || pocket.name === "right") {
        directions = ["left", "right"];
      } else {
        directions = ["up", "down"];
      }
    }
    const pathDir = pathDirections.get(coordKey(pos.x, pos.y));
    if (pathDir && !directions.includes(pathDir)) {
      directions.push(pathDir);
    }

    tiles[pos.y][pos.x] = {
      type: "block",
      uncovered: false,
      directions,
    };
    blocks.push({ x: pos.x, y: pos.y });
  }

  const trapCandidates = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (isStartArea(x, y, startArea)) {
        continue;
      }
      if (pathSet.has(coordKey(x, y))) {
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
  const trapCount = Math.min(trapCandidates.length, 6 + level * 2);
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
      if (pathSet.has(coordKey(x, y))) {
        continue;
      }
      if (coordKey(x, y) === coordKey(exit.x, exit.y)) {
        continue;
      }
      if (reachable.has(coordKey(x, y))) {
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

class MinHeap {
  constructor() {
    this.data = [];
  }

  push(item) {
    this.data.push(item);
    let index = this.data.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.data[parent].priority <= item.priority) {
        break;
      }
      this.data[index] = this.data[parent];
      index = parent;
    }
    this.data[index] = item;
  }

  pop() {
    if (this.data.length === 0) {
      return null;
    }
    const root = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = index * 2 + 2;
        let smallest = index;
        if (left < this.data.length && this.data[left].priority < this.data[smallest].priority) {
          smallest = left;
        }
        if (right < this.data.length && this.data[right].priority < this.data[smallest].priority) {
          smallest = right;
        }
        if (smallest === index) {
          break;
        }
        [this.data[index], this.data[smallest]] = [this.data[smallest], this.data[index]];
        index = smallest;
      }
    }
    return root;
  }

  isEmpty() {
    return this.data.length === 0;
  }
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

function estimateMinPushes({ tiles, width, height, startArea, exit }) {
  const blocks = buildBlockList(tiles);
  const blockPositions = blocks.map((block) => block.y * width + block.x);
  const exitIndex = exit.y * width + exit.x;

  const isWall = (x, y) => tiles[y][x].type === "rock";
  const isBlockedForBlock = (x, y) => {
    const type = tiles[y][x].type;
    return type === "rock" || type === "trap" || type === "exit";
  };

  const stateKey = (playerIndex, positions) =>
    `${playerIndex}|${positions.join(",")}`;

  const heap = new MinHeap();
  const dist = new Map();

  for (let y = startArea.y; y < startArea.y + startArea.size; y += 1) {
    for (let x = startArea.x; x < startArea.x + startArea.size; x += 1) {
      const startIndex = y * width + x;
      const key = stateKey(startIndex, blockPositions);
      if (!dist.has(key)) {
        dist.set(key, 0);
        heap.push({ priority: 0, playerIndex: startIndex, positions: blockPositions });
      }
    }
  }

  while (!heap.isEmpty()) {
    const current = heap.pop();
    if (!current) {
      break;
    }
    const currentKey = stateKey(current.playerIndex, current.positions);
    const currentDist = dist.get(currentKey);
    if (currentDist !== current.priority) {
      continue;
    }
    if (current.playerIndex === exitIndex) {
      return currentDist;
    }

    const blockMap = new Map();
    current.positions.forEach((pos, index) => {
      blockMap.set(pos, index);
    });

    const px = current.playerIndex % width;
    const py = Math.floor(current.playerIndex / width);

    for (const dir of DIRECTIONS) {
      const nx = px + dir.dx;
      const ny = py + dir.dy;
      if (!inBounds(nx, ny, width, height)) {
        continue;
      }
      if (isWall(nx, ny)) {
        continue;
      }

      const nextIndex = ny * width + nx;
      const blockIndex = blockMap.get(nextIndex);

      if (blockIndex === undefined) {
        const nextKey = stateKey(nextIndex, current.positions);
        const nextDist = currentDist;
        if (!dist.has(nextKey) || nextDist < dist.get(nextKey)) {
          dist.set(nextKey, nextDist);
          heap.push({ priority: nextDist, playerIndex: nextIndex, positions: current.positions });
        }
        continue;
      }

      const chain = [];
      let cx = nx;
      let cy = ny;
      let valid = true;
      while (true) {
        const chainIndex = blockMap.get(cy * width + cx);
        if (chainIndex === undefined) {
          break;
        }
        const block = blocks[chainIndex];
        if (!block.directions || !block.directions.includes(dir.name)) {
          valid = false;
          break;
        }
        chain.push(chainIndex);
        cx += dir.dx;
        cy += dir.dy;
        if (!inBounds(cx, cy, width, height)) {
          valid = false;
          break;
        }
      }
      if (!valid) {
        continue;
      }
      if (!inBounds(cx, cy, width, height)) {
        continue;
      }
      if (isBlockedForBlock(cx, cy)) {
        continue;
      }
      if (cx === exit.x && cy === exit.y) {
        continue;
      }
      if (blockMap.has(cy * width + cx)) {
        continue;
      }

      const updated = current.positions.slice();
      chain.forEach((index) => {
        const pos = current.positions[index];
        const x = pos % width;
        const y = Math.floor(pos / width);
        updated[index] = (y + dir.dy) * width + (x + dir.dx);
      });
      const nextKey = stateKey(nextIndex, updated);
      const nextDist = currentDist + 1;
      if (!dist.has(nextKey) || nextDist < dist.get(nextKey)) {
        dist.set(nextKey, nextDist);
        heap.push({ priority: nextDist, playerIndex: nextIndex, positions: updated });
      }
    }
  }

  return Infinity;
}

function generateLevel({ level, seed, width, height }) {
  const targetPushes = 2 * level;
  const maxAttempts = 120;
  const minMonsterTiles = 5;
  let bestCandidate = null;
  let bestPushes = -Infinity;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const attemptSeed = seed + attempt * 173;
    const generated = generateLevelOnce({
      level,
      seed: attemptSeed,
      width,
      height,
    });
    const minPushes = estimateMinPushes(generated);
    const hasMobility = monstersHaveMobility(generated, minMonsterTiles);
    if (Number.isFinite(minPushes) && hasMobility && minPushes > bestPushes) {
      bestPushes = minPushes;
      bestCandidate = generated;
    }
    if (Number.isFinite(minPushes) && minPushes >= targetPushes && hasMobility) {
      return generated;
    }
  }
  if (bestCandidate) {
    return bestCandidate;
  }
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const attemptSeed = seed + attempt * 409;
    const generated = generateLevelOnce({
      level,
      seed: attemptSeed,
      width,
      height,
    });
    if (monstersHaveMobility(generated, minMonsterTiles)) {
      return generated;
    }
  }
  return generateLevelOnce({ level, seed, width, height });
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
        avatar: token.avatar || "",
        initiativeMod: Number.isFinite(token.initiativeMod) ? token.initiativeMod : 0,
        x: pos.x,
        y: pos.y,
        lastMoveAt: 0,
      };
    });
  }

  return positions.map((pos, index) => ({
    id: `p${index + 1}`,
    name: "",
    ownerId: null,
    gold: 0,
    avatar: "",
    initiativeMod: 0,
    x: pos.x,
    y: pos.y,
    lastMoveAt: 0,
  }));
}

function createGame({
  level = 1,
  seed = 42,
  tokens = null,
  tokenCount = 4,
  monsterConfig = null,
} = {}) {
  const width = DEFAULT_WIDTH;
  const height = DEFAULT_HEIGHT;
  const generated = generateLevel({ level, seed, width, height });
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
    width,
    height,
    tiles: generated.tiles,
    startArea: generated.startArea,
    exit: generated.exit,
    tokens: nextTokens,
    monsters: generated.monsters,
    monsterConfig: nextMonsterConfig,
    combat: null,
    pendingTrap: null,
  };
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
  state.combat.order = state.combat.order.filter(
    (entry) => entry.type !== "monster" || aliveMonsters.has(entry.id)
  );
  if (state.combat.currentIndex >= state.combat.order.length) {
    state.combat.currentIndex = Math.max(0, state.combat.order.length - 1);
  }
  syncOtherMonstersEntry(state, state.combat);
  if (state.monsters.length === 0) {
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
  const entries = state.tokens.map((token) => {
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
function serializeTile(tile, count, role, visible, uncovered) {
  if (role === "player" && !visible) {
    return { visible: false };
  }
  const payload = {
    visible: true,
    uncovered,
    type: tile.type,
  };
  if (role === "player" && tile.type === "trap" && !uncovered) {
    payload.type = "unknown";
  }
  if (tile.type === "block") {
    payload.directions = tile.directions || [];
  }
  if (tile.type === "treasure") {
    payload.value = role === "dm" ? tile.value : null;
  }
  if (tile.type === "empty" && (uncovered || role === "dm")) {
    payload.number = count;
  }
  if (tile.type === "exit") {
    payload.exit = true;
  }
  return payload;
}

function serializeState(state, { role, socketId }) {
  const counts = computeTrapAdjacency(state.tiles, state.width, state.height);
  const visibility = role === "dm" ? null : computeVisibility(state.tiles, state.width, state.height);
  const tokens = state.tokens.map((token) => ({
    id: token.id,
    name: token.name,
    gold: token.gold,
    avatar: token.avatar,
    initiativeMod: token.initiativeMod,
    x: token.x,
    y: token.y,
    owned: Boolean(token.ownerId),
    ownedBySelf: token.ownerId === socketId,
  }));

  const players = state.tokens;
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
      const visibleToPlayer = players.some(
        (token) => manhattan(token, monster) <= 10
      );
      if (!visibleToPlayer) {
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
      const visible = role === "dm" ? true : visibility[y][x];
      return serializeTile(tile, counts[y][x], role, visible, uncovered);
    })
  );

  return {
    gameId: state.gameId,
    gameName: state.name,
    level: state.level,
    seed: state.seed,
    width: state.width,
    height: state.height,
    startArea: state.startArea,
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
}

function findTokenAt(state, x, y) {
  return state.tokens.find((token) => token.x === x && token.y === y) || null;
}

function findMonsterAt(state, x, y) {
  return state.monsters.find((monster) => monster.x === x && monster.y === y) || null;
}

function canMonsterMoveInto(tile) {
  return tile.type === "empty" || tile.type === "treasure";
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
    blocks.push({ x: cursor.x, y: cursor.y, directions: tile.directions });
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
    startTile.type === "block"
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
        tile.type === "block"
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
      if (line[i].tile.type === "treasure") {
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
        entry.tile.type === "treasure" ? { value: entry.tile.value } : null,
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
        state.tiles[dest.y][dest.x] = {
          type: "treasure",
          uncovered: destUncovered,
          value: source.treasure.value,
        };
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
    state.tiles[destY][destX] = {
      type: "block",
      uncovered: blockDestUncovered[i],
      directions: block.directions,
    };
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
  if (Math.abs(dx) + Math.abs(dy) !== 1) {
    return { ok: false, error: "Move one tile at a time." };
  }
  const now = context.now || Date.now();
  const minInterval = 1000 / PLAYER_SPEED_TPS;
  if (now - token.lastMoveAt < minInterval) {
    return { ok: false, error: "Slow down. You can move 3 tiles per second." };
  }
  const sounds = [];

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
  const dir = DIRECTIONS.find((step) => step.dx === dx && step.dy === dy);
  if (tile.type === "rock") {
    return { ok: false, error: "Solid rock blocks the way." };
  }
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
    return {
      ok: true,
      announcement: `${token.name || "A hero"} gains ${gain} gold.`,
      sounds,
    };
  }

  if (tile.type === "exit") {
    token.x = target.x;
    token.y = target.y;
    token.lastMoveAt = now;
    return { ok: true, reachedExit: true, sounds };
  }

  token.x = target.x;
  token.y = target.y;
  token.lastMoveAt = now;
  tile.uncovered = true;
  return { ok: true, sounds };
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
  if (tile.type === "rock" || tile.type === "exit") {
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
    avatar: token.avatar,
    initiativeMod: token.initiativeMod,
  }));
  return createGame({
    level: state.level + 1,
    seed: state.seed,
    tokens: nextTokens,
    tokenCount: state.tokens.length,
    monsterConfig: state.monsterConfig,
  });
}

function resetLevel(state) {
  const nextTokens = state.tokens.map((token) => ({
    id: token.id,
    name: token.name,
    ownerId: token.ownerId,
    gold: token.gold,
    avatar: token.avatar,
    initiativeMod: token.initiativeMod,
  }));
  return createGame({
    level: state.level,
    seed: state.seed,
    tokens: nextTokens,
    tokenCount: state.tokens.length,
    monsterConfig: state.monsterConfig,
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
  if (monster.type === "violet") {
    const path = findShortestPath(
      { x: monster.x, y: monster.y },
      state.tokens.map((token) => ({ x: token.x, y: token.y })),
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
    let nearest = state.tokens[0];
    let bestDistance = nearest ? manhattan(monster, nearest) : Infinity;
    state.tokens.forEach((token) => {
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
  setMonsterConfig,
  setCombatInitiative,
  resortCombat,
  addMonsterToCombat,
  advanceCombatTurn,
  deleteMonster,
  exitCombat,
  advanceLevel,
  resetLevel,
  releaseTokenOwnership,
  updateMonsters,
};
