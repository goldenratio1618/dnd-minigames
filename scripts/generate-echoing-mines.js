#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const mines = require("../server/game/echoing-mines");

function getArg(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) {
    return fallback;
  }
  return process.argv[index + 1];
}

const level = Number.parseInt(getArg("--level", "1"), 10) || 1;
const count = Number.parseInt(getArg("--count", "5"), 10) || 5;
const baseSeedRaw = getArg("--seed", null);
const outputDir = getArg(
  "--out",
  path.join(process.cwd(), "generated", "echoing-mines")
);
const cellSize = Number.parseInt(getArg("--cell", "16"), 10) || 16;
const logEvery = Math.max(1, Number.parseInt(getArg("--log-every", "10"), 10) || 10);

function readCount(flag) {
  if (!process.argv.includes(flag)) {
    return null;
  }
  const value = Number.parseInt(getArg(flag, "0"), 10);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

const gateConfig = {};
const gateOneWay = readCount("--gate-one-way");
if (gateOneWay !== null) gateConfig.oneWay = gateOneWay;
const gateTwoWay = readCount("--gate-two-way");
if (gateTwoWay !== null) gateConfig.twoWay = gateTwoWay;
const gateToggle = readCount("--gate-toggle");
if (gateToggle !== null) gateConfig.toggle = gateToggle;
const gateSwitchback = readCount("--gate-switchback");
if (gateSwitchback !== null) gateConfig.switchback = gateSwitchback;
const gateShared = readCount("--gate-shared");
if (gateShared !== null) gateConfig.shared = gateShared;
const gateBuffer = readCount("--gate-buffer");
if (gateBuffer !== null) gateConfig.buffer = gateBuffer;
const gateChain = readCount("--gate-chain");
if (gateChain !== null) gateConfig.chain = gateChain;
const gateInterlock = readCount("--gate-interlock");
if (gateInterlock !== null) gateConfig.interlock = gateInterlock;
const gateDoorWall = readCount("--gate-doorwall");
if (gateDoorWall !== null) gateConfig.doorWall = gateDoorWall;

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crcValue = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crcValue, 0);
  return Buffer.concat([lengthBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgbaData) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = pngChunk("IHDR", ihdr);
  const compressed = zlib.deflateSync(rgbaData);
  const idatChunk = pngChunk("IDAT", compressed);
  const iendChunk = pngChunk("IEND", Buffer.alloc(0));
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const COLORS = {
  rock: [18, 16, 12, 255],
  empty: [70, 60, 45, 255],
  block: [160, 120, 60, 255],
  trap: [200, 80, 60, 255],
  treasure: [210, 175, 90, 255],
  exit: [120, 170, 230, 255],
};

function tileColor(tile, startArea, x, y) {
  if (
    startArea &&
    x >= startArea.x &&
    x < startArea.x + startArea.size &&
    y >= startArea.y &&
    y < startArea.y + startArea.size
  ) {
    return [100, 150, 110, 255];
  }
  const color = COLORS[tile.type] || COLORS.empty;
  return color;
}

function renderLevelPng(state, cellSizeValue) {
  const width = state.width * cellSizeValue;
  const height = state.height * cellSizeValue;
  const stride = width * 4 + 1;
  const buffer = Buffer.alloc(stride * height);

  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const color = tileColor(state.tiles[y][x], state.startArea, x, y);
      for (let py = 0; py < cellSizeValue; py += 1) {
        const row = y * cellSizeValue + py;
        const rowStart = row * stride;
        buffer[rowStart] = 0;
        for (let px = 0; px < cellSizeValue; px += 1) {
          const col = x * cellSizeValue + px;
          const index = rowStart + 1 + col * 4;
          buffer[index] = color[0];
          buffer[index + 1] = color[1];
          buffer[index + 2] = color[2];
          buffer[index + 3] = color[3];
        }
      }
    }
  }

  return encodePng(width, height, buffer);
}

function toSeed(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function generateSeeds(base, total) {
  if (base !== null) {
    return Array.from({ length: total }, (_, index) => base + index);
  }
  return Array.from({ length: total }, () => Math.floor(Math.random() * 1000000000));
}

function buildStats(state, seed) {
  const solver = state.solver || {};
  return {
    seed,
    level: state.level,
    width: state.width,
    height: state.height,
    pushes: solver.pushes || 0,
    distinctBlocksPushed: solver.distinctBlocksPushed || 0,
    revisitedSquares: solver.revisitedSquares || 0,
    revisitEvents: solver.revisitEvents || 0,
    unintuitivePushes: solver.unintuitivePushes || 0,
    moves: Array.isArray(solver.moves) ? solver.moves.length : 0,
    generationAttempts: state.generationAttempts || 0,
  };
}

function normalizeSnapshotTile(tile) {
  if (!tile || !tile.type) {
    return { type: "rock", uncovered: false };
  }
  const uncovered = Boolean(tile.uncovered);
  if (tile.type === "block") {
    return {
      type: "block",
      uncovered,
      directions: Array.isArray(tile.directions) ? tile.directions.slice() : [],
    };
  }
  if (tile.type === "treasure") {
    return {
      type: "treasure",
      uncovered,
      value: Number.isFinite(tile.value) ? tile.value : 0,
    };
  }
  if (tile.type === "magic-item") {
    return {
      type: "magic-item",
      uncovered,
      itemName:
        typeof tile.itemName === "string" && tile.itemName.trim().length > 0
          ? tile.itemName.trim()
          : "",
    };
  }
  if (tile.type === "trap") {
    return {
      type: "trap",
      uncovered,
      message: typeof tile.message === "string" ? tile.message : "",
    };
  }
  if (tile.type === "exit") {
    return { type: "exit", uncovered };
  }
  if (tile.type === "empty") {
    return { type: "empty", uncovered };
  }
  return { type: "rock", uncovered };
}

function buildSnapshot(state) {
  return {
    level: state.level,
    seed: state.seed,
    width: state.width,
    height: state.height,
    startArea: state.startArea,
    exit: state.exit,
    generationAttempts: state.generationAttempts || 1,
    solver: state.solver || null,
    tiles: state.tiles.map((row) => row.map((tile) => normalizeSnapshotTile(tile))),
    monsters: Array.isArray(state.monsters)
      ? state.monsters.map((monster) => ({
          id: monster.id,
          type: monster.type,
          x: monster.x,
          y: monster.y,
        }))
      : [],
  };
}

function writeLevelFiles(state, seed, outDir, cellSizeValue) {
  const safeSeed = String(seed);
  const baseName = `level-${state.level}-seed-${safeSeed}`;
  const pngPath = path.join(outDir, `${baseName}.png`);
  const jsonPath = path.join(outDir, `${baseName}.json`);
  const snapshotPath = path.join(outDir, `${baseName}.snapshot.json`);

  const png = renderLevelPng(state, cellSizeValue);
  fs.writeFileSync(pngPath, png);

  const stats = buildStats(state, seed);
  fs.writeFileSync(jsonPath, JSON.stringify(stats, null, 2));
  const snapshot = buildSnapshot(state);
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  stats.snapshotPath = snapshotPath;
  return stats;
}

function main() {
  ensureDir(outputDir);
  const seeds = generateSeeds(toSeed(baseSeedRaw), count);
  const summary = [];

  const gateConfigArg = Object.keys(gateConfig).length > 0 ? gateConfig : null;

  seeds.forEach((seed, index) => {
    const seedLabel = `[${index + 1}/${seeds.length}]`;
    console.log(`${seedLabel} Generating level ${level} with seed ${seed}...`);
    let lastLogged = 0;
    const game = mines.createGame({
      level,
      seed,
      gateConfig: gateConfigArg,
      onProgress: (info) => {
        if (!info || !Number.isFinite(info.attempt)) {
          return;
        }
        if (info.attempt === 1 || info.attempt - lastLogged >= logEvery) {
          lastLogged = info.attempt;
          console.log(
            `${seedLabel} Attempt ${info.attempt} (size ${info.width}x${info.height}, seed ${info.seed})`
          );
        }
      },
    });
    if (!game.solver) {
      console.error(`No solver path for seed ${seed}. Skipping.`);
      return;
    }
    const stats = writeLevelFiles(game, seed, outputDir, cellSize);
    console.log(
      `${seedLabel} Done after ${stats.generationAttempts} attempts (final size ${stats.width}x${stats.height}).`
    );
    summary.push(stats);
  });

  const summaryPath = path.join(outputDir, `summary-level-${level}.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`Generated ${summary.length} levels in ${outputDir}`);
}

main();
