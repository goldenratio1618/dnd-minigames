const DIRECTIONS = [
  { name: "up", dx: 0, dy: -1 },
  { name: "down", dx: 0, dy: 1 },
  { name: "left", dx: -1, dy: 0 },
  { name: "right", dx: 1, dy: 0 },
];

function inBounds(x, y, width, height) {
  return x >= 0 && x < width && y >= 0 && y < height;
}

function coordKey(x, y) {
  return `${x},${y}`;
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

class MinHeap {
  constructor(compare) {
    this.items = [];
    this.compare = compare;
  }

  push(item) {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) {
      return null;
    }
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  isEmpty() {
    return this.items.length === 0;
  }

  bubbleUp(index) {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.compare(this.items[current], this.items[parent]) >= 0) {
        break;
      }
      [this.items[current], this.items[parent]] = [
        this.items[parent],
        this.items[current],
      ];
      current = parent;
    }
  }

  bubbleDown(index) {
    const length = this.items.length;
    let current = index;
    while (true) {
      const left = current * 2 + 1;
      const right = current * 2 + 2;
      let smallest = current;

      if (left < length && this.compare(this.items[left], this.items[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this.compare(this.items[right], this.items[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === current) {
        break;
      }
      [this.items[current], this.items[smallest]] = [
        this.items[smallest],
        this.items[current],
      ];
      current = smallest;
    }
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

function stateKey(playerIndex, positions) {
  return `${playerIndex}|${positions.join(",")}`;
}

function findDirection(name) {
  return DIRECTIONS.find((dir) => dir.name === name) || null;
}

function reconstructMoves(prev, goalKey, width) {
  const moves = [];
  let cursor = goalKey;
  while (cursor) {
    const entry = prev.get(cursor);
    if (!entry) {
      break;
    }
    if (entry.move) {
      moves.unshift(entry.move);
    }
    cursor = entry.prevKey;
  }
  const startKey = cursor || goalKey;
  const playerIndex = Number.parseInt(startKey.split("|")[0], 10);
  return {
    moves,
    start: {
      x: playerIndex % width,
      y: Math.floor(playerIndex / width),
    },
  };
}

function analyzeSolution({ moves, start, tiles, width, height, exit }) {
  const blocks = buildBlockList(tiles);
  const positions = blocks.map((block) => block.y * width + block.x);
  const usedSquares = new Set();
  const movedBlocks = new Set();
  const revisitedSquares = new Set();
  let revisitEvents = 0;
  const visitCounts = new Map();
  const addUsedSquare = (x, y) => {
    usedSquares.add(coordKey(x, y));
  };
  const recordPlayerVisit = (x, y) => {
    const key = coordKey(x, y);
    usedSquares.add(key);
    const visits = (visitCounts.get(key) || 0) + 1;
    visitCounts.set(key, visits);
    if (visits === 2) {
      revisitedSquares.add(key);
      revisitEvents += 1;
    } else if (visits > 2) {
      revisitEvents += 1;
    }
  };

  positions.forEach((pos) => {
    addUsedSquare(pos % width, Math.floor(pos / width));
  });
  let player = { x: start.x, y: start.y };
  recordPlayerVisit(player.x, player.y);

  let pushes = 0;
  let unintuitivePushes = 0;

  moves.forEach((move) => {
    const dir = findDirection(move.dir);
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
      pushes += 1;
      const distBefore = manhattan(target, exit);
      const distAfter = manhattan({ x: target.x + dir.dx, y: target.y + dir.dy }, exit);
      if (distAfter > distBefore) {
        unintuitivePushes += 1;
      }

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
        if (!inBounds(cx, cy, width, height)) {
          break;
        }
      }

      chain.forEach((index) => {
        movedBlocks.add(index);
        positions[index] += dir.dx + dir.dy * width;
      });
    }

    player = { x: target.x, y: target.y };
    recordPlayerVisit(player.x, player.y);
    positions.forEach((pos) => {
      addUsedSquare(pos % width, Math.floor(pos / width));
    });
  });

  return {
    pushes,
    unintuitivePushes,
    usedSquares,
    distinctBlocksPushed: movedBlocks.size,
    revisitedSquares: revisitedSquares.size,
    revisitEvents,
  };
}

function solveBlockPuzzle({
  tiles,
  width,
  height,
  startArea,
  exit,
  maxStates = 240000,
  maxPushes = Infinity,
  maxSteps = Infinity,
} = {}) {
  if (!tiles || !startArea || !exit) {
    return null;
  }
  const stateLimit = Number.isFinite(maxStates) ? maxStates : null;
  const pushLimit = Number.isFinite(maxPushes) ? maxPushes : Infinity;
  const stepLimit = Number.isFinite(maxSteps) ? maxSteps : Infinity;
  const blocks = buildBlockList(tiles);
  const blockPositions = blocks.map((block) => block.y * width + block.x);
  const exitIndex = exit.y * width + exit.x;

  const isWall = (x, y) => tiles[y][x].type === "rock";
  const isBlockedForBlock = (x, y) => {
    const type = tiles[y][x].type;
    return type === "rock" || type === "trap" || type === "exit";
  };

  const heap = new MinHeap((a, b) => {
    if (a.pushes !== b.pushes) {
      return a.pushes - b.pushes;
    }
    return a.steps - b.steps;
  });
  const dist = new Map();
  const prev = new Map();

  for (let y = startArea.y; y < startArea.y + startArea.size; y += 1) {
    for (let x = startArea.x; x < startArea.x + startArea.size; x += 1) {
      const startIndex = y * width + x;
      const key = stateKey(startIndex, blockPositions);
      if (!dist.has(key)) {
        dist.set(key, { pushes: 0, steps: 0 });
        prev.set(key, null);
        heap.push({
          playerIndex: startIndex,
          positions: blockPositions,
          pushes: 0,
          steps: 0,
        });
      }
    }
  }

  let goalKey = null;

  while (!heap.isEmpty()) {
    const current = heap.pop();
    if (!current) {
      break;
    }
    const currentKey = stateKey(current.playerIndex, current.positions);
    const best = dist.get(currentKey);
    if (!best || best.pushes !== current.pushes || best.steps !== current.steps) {
      continue;
    }
    if (current.pushes > pushLimit) {
      break;
    }
    if (current.steps > stepLimit) {
      continue;
    }
    if (current.playerIndex === exitIndex) {
      goalKey = currentKey;
      break;
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
        const nextPushes = current.pushes;
        const nextSteps = current.steps + 1;
        const nextBest = dist.get(nextKey);
        if (nextPushes > pushLimit || nextSteps > stepLimit) {
          continue;
        }
        if (
          !nextBest ||
          nextPushes < nextBest.pushes ||
          (nextPushes === nextBest.pushes && nextSteps < nextBest.steps)
        ) {
          const isNew = !nextBest;
          dist.set(nextKey, { pushes: nextPushes, steps: nextSteps });
          if (isNew && stateLimit && dist.size > stateLimit) {
            return null;
          }
          prev.set(nextKey, { prevKey: currentKey, move: { dir: dir.name, push: false } });
          heap.push({
            playerIndex: nextIndex,
            positions: current.positions,
            pushes: nextPushes,
            steps: nextSteps,
          });
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
      const nextPushes = current.pushes + 1;
      const nextSteps = current.steps + 1;
      if (nextPushes > pushLimit || nextSteps > stepLimit) {
        continue;
      }
      const nextBest = dist.get(nextKey);
      if (
        !nextBest ||
        nextPushes < nextBest.pushes ||
        (nextPushes === nextBest.pushes && nextSteps < nextBest.steps)
      ) {
        const isNew = !nextBest;
        dist.set(nextKey, { pushes: nextPushes, steps: nextSteps });
        if (isNew && stateLimit && dist.size > stateLimit) {
          return null;
        }
        prev.set(nextKey, { prevKey: currentKey, move: { dir: dir.name, push: true } });
        heap.push({
          playerIndex: nextIndex,
          positions: updated,
          pushes: nextPushes,
          steps: nextSteps,
        });
      }
    }
  }

  if (!goalKey) {
    return null;
  }

  const path = reconstructMoves(prev, goalKey, width);
  const analysis = analyzeSolution({
    moves: path.moves,
    start: path.start,
    tiles,
    width,
    height,
    exit,
  });

  return {
    moves: path.moves,
    start: path.start,
    pushes: analysis.pushes,
    unintuitivePushes: analysis.unintuitivePushes,
    usedSquares: analysis.usedSquares,
    distinctBlocksPushed: analysis.distinctBlocksPushed,
    revisitedSquares: analysis.revisitedSquares,
    revisitEvents: analysis.revisitEvents,
  };
}

module.exports = {
  solveBlockPuzzle,
};
