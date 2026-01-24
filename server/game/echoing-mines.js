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

function generateLevel({ level, seed, width, height }) {
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
      !(pos.x === exit.x && pos.y === exit.y)
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
    x: pos.x,
    y: pos.y,
    lastMoveAt: 0,
  }));
}

function createGame({ level = 1, seed = 42, tokens = null, tokenCount = 4 } = {}) {
  const width = DEFAULT_WIDTH;
  const height = DEFAULT_HEIGHT;
  const generated = generateLevel({ level, seed, width, height });
  const nextTokens = createTokens({
    tokens,
    tokenCount,
    startArea: generated.startArea,
  });

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
    x: token.x,
    y: token.y,
    owned: Boolean(token.ownerId),
    ownedBySelf: token.ownerId === socketId,
  }));

  const players = state.tokens;
  const monsters = state.monsters
    .map((monster) => {
      if (role === "dm") {
        return { id: monster.id, type: monster.type, x: monster.x, y: monster.y };
      }
      const visibleToPlayer = players.some(
        (token) => manhattan(token, monster) <= 10
      );
      if (!visibleToPlayer) {
        return null;
      }
      return { id: monster.id, type: monster.type, x: monster.x, y: monster.y };
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
  const blockTile = state.tiles[blockPos.y][blockPos.x];
  if (blockTile.type !== "block") {
    return { ok: false };
  }
  if (!blockTile.directions || !blockTile.directions.includes(dir.name)) {
    return { ok: false, error: "That block will not move that way." };
  }
  const destX = blockPos.x + dir.dx;
  const destY = blockPos.y + dir.dy;
  if (!inBounds(destX, destY, state.width, state.height)) {
    return { ok: false, error: "That block cannot move there." };
  }
  const destTile = state.tiles[destY][destX];
  if (requireUncovered && !destTile.uncovered) {
    return { ok: false, error: "That block needs clear ground ahead." };
  }
  if (destTile.type !== "empty") {
    return { ok: false, error: "That block cannot move there." };
  }
  if (findMonsterAt(state, destX, destY)) {
    return { ok: false, error: "That block cannot move there." };
  }
  const player = findTokenAt(state, destX, destY);
  let pushedPlayer = false;
  if (player && options.allowPushPlayer) {
    const pushTarget = findPushDestination(state, player, dir);
    if (!pushTarget) {
      return { ok: false, error: "That block cannot move there." };
    }
    if (!dryRun) {
      pushPlayerAway(state, player, dir);
    }
    pushedPlayer = true;
  } else if (player) {
    return { ok: false, error: "That block cannot move there." };
  }

  if (dryRun) {
    return { ok: true, destX, destY, pushedPlayer };
  }

  state.tiles[destY][destX] = {
    type: "block",
    uncovered: destTile.uncovered,
    directions: blockTile.directions,
  };
  state.tiles[blockPos.y][blockPos.x] = createEmptyTile();
  state.tiles[blockPos.y][blockPos.x].uncovered = true;
  return { ok: true, pushedPlayer };
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

  if (findTokenAt(state, target.x, target.y)) {
    return { ok: false, error: "That space is already occupied." };
  }

  const monster = findMonsterAt(state, target.x, target.y);
  if (monster) {
    return {
      ok: false,
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
    };
  }

  if (tile.type === "exit") {
    token.x = target.x;
    token.y = target.y;
    token.lastMoveAt = now;
    return { ok: true, reachedExit: true };
  }

  token.x = target.x;
  token.y = target.y;
  token.lastMoveAt = now;
  tile.uncovered = true;
  return { ok: true };
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

function advanceLevel(state) {
  const nextTokens = state.tokens.map((token) => ({
    id: token.id,
    name: token.name,
    ownerId: token.ownerId,
    gold: token.gold,
    avatar: token.avatar,
  }));
  return createGame({
    level: state.level + 1,
    seed: state.seed,
    tokens: nextTokens,
    tokenCount: state.tokens.length,
  });
}

function resetLevel(state) {
  const nextTokens = state.tokens.map((token) => ({
    id: token.id,
    name: token.name,
    ownerId: token.ownerId,
    gold: token.gold,
    avatar: token.avatar,
  }));
  return createGame({
    level: state.level,
    seed: state.seed,
    tokens: nextTokens,
    tokenCount: state.tokens.length,
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
  }
  const player = findTokenAt(state, move.x, move.y);
  if (player) {
    pushPlayerAway(state, player, move.dir);
    return {
      hit: true,
      message: MONSTER_HIT_MESSAGES[monster.type] || "A monster strikes!",
    };
  }
  monster.x = move.x;
  monster.y = move.y;
  if (pushedPlayer) {
    return {
      hit: true,
      message: "A yellow brute shoves a block into a hero!",
    };
  }
  return { hit: false };
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

function updateMonsters(state, { now } = {}) {
  if (state.pendingTrap) {
    return { changed: false, events: [] };
  }
  const timestamp = now || Date.now();
  const events = [];
  let changed = false;

  state.monsters.forEach((monster) => {
    let speed = MONSTER_SPEED_TPS;
    let move = null;
    if (monster.type === "violet") {
      const path = findShortestPath(
        { x: monster.x, y: monster.y },
        state.tokens.map((token) => ({ x: token.x, y: token.y })),
        state
      );
      if (!path || path.length < 2) {
        return;
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
        return;
      }
      const dx = nearest.x - monster.x;
      const dy = nearest.y - monster.y;
      let preferred = null;
      if (Math.abs(dx) >= Math.abs(dy)) {
        preferred = dx >= 0 ? DIRECTIONS.find((d) => d.name === "right") : DIRECTIONS.find((d) => d.name === "left");
      } else {
        preferred = dy >= 0 ? DIRECTIONS.find((d) => d.name === "down") : DIRECTIONS.find((d) => d.name === "up");
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
      }
    }
  });

  return { changed, events };
}

module.exports = {
  GAME_ID,
  GAME_NAME,
  createGame,
  serializeState,
  applyMove,
  setTokenName,
  setTokenAvatar,
  advanceLevel,
  resetLevel,
  releaseTokenOwnership,
  updateMonsters,
};
