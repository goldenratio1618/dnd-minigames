const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const game = require("./game/arcane-cells");
const solver = require("./game/arcane-cells-solver");
const minesGame = require("./game/echoing-mines");
const { createTabletopSystem } = require("./game/tabletop");

const PORT = Number.parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
app.set("trust proxy", false);
const DM_PASSWORD = "python";
const DM_COOKIE_NAME = "dm-auth";

function normalizeAddress(address) {
  if (!address) {
    return "";
  }
  if (address.startsWith("::ffff:")) {
    return address.slice(7);
  }
  return address;
}

function isPrivateAddress(address) {
  const normalized = normalizeAddress(address);
  if (!normalized) {
    return false;
  }
  if (normalized === "127.0.0.1" || normalized === "::1") {
    return true;
  }
  if (normalized.includes(":")) {
    const lower = normalized.toLowerCase();
    if (lower.startsWith("fc") || lower.startsWith("fd")) {
      return true;
    }
    if (
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb")
    ) {
      return true;
    }
    return false;
  }

  const parts = normalized.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  return false;
}

function privateOnly(req, res, next) {
  const address = req.socket.remoteAddress;
  if (isPrivateAddress(address)) {
    return next();
  }
  res.status(403).send("Access limited to local networks.");
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const entries = header.split(";").map((part) => part.trim()).filter(Boolean);
  return entries.reduce((acc, entry) => {
    const [key, ...rest] = entry.split("=");
    if (!key) {
      return acc;
    }
    acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

app.use(privateOnly);
app.use(express.urlencoded({ extended: false }));

function serveDmPage(req, res, filename) {
  const cookies = parseCookies(req);
  if (cookies[DM_COOKIE_NAME] === DM_PASSWORD) {
    res.sendFile(path.join(__dirname, "..", "public", filename));
    return;
  }
  res.status(401).send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>DM Access</title>
        <style>
          body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#120f0b;color:#f4e8cf;font-family:"Cinzel","Garamond",serif;}
          form{background:rgba(12,9,6,0.85);border:1px solid rgba(255,255,255,0.12);padding:24px 28px;border-radius:14px;box-shadow:0 12px 24px rgba(0,0,0,0.45);min-width:280px;}
          label{display:block;margin-bottom:8px;letter-spacing:0.12em;text-transform:uppercase;font-size:0.75rem;color:#c9b48b;}
          input{width:100%;padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:#0b0906;color:#f4e8cf;font-size:1rem;}
          button{margin-top:14px;width:100%;padding:10px 12px;border-radius:10px;border:none;background:#b31212;color:#fbe7e2;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;}
        </style>
      </head>
      <body>
        <form method="post" action="/dm-auth">
          <label for="dm-password">DM Password</label>
          <input id="dm-password" name="password" type="password" autocomplete="current-password" />
          <button type="submit">Enter</button>
        </form>
      </body>
    </html>
  `);
}

app.get("/dm.html", (req, res) => {
  serveDmPage(req, res, "dm.html");
});

app.get("/dm-echoing-mines.html", (req, res) => {
  serveDmPage(req, res, "dm-echoing-mines.html");
});

app.get("/dm-tabletop.html", (req, res) => {
  serveDmPage(req, res, "dm-tabletop.html");
});

app.post("/dm-auth", (req, res) => {
  const password = String(req.body && req.body.password ? req.body.password : "");
  if (password !== DM_PASSWORD) {
    res.status(401).send("Incorrect password.");
    return;
  }
  res.setHeader(
    "Set-Cookie",
    `${DM_COOKIE_NAME}=${encodeURIComponent(DM_PASSWORD)}; Path=/; SameSite=Lax`
  );
  res.redirect("/dm.html");
});

app.use(express.static(path.join(__dirname, "..", "public")));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: false,
  },
});

io.use((socket, next) => {
  const address = socket.handshake.address;
  if (isPrivateAddress(address)) {
    return next();
  }
  return next(new Error("Access limited to local networks."));
});

createTabletopSystem(io, {
  dataDirectory: path.join(__dirname, "..", "generated", "tabletop"),
  dmPassword: DM_PASSWORD,
});

const DEFAULT_SEED = 42;
let state = game.createGame({ trapCount: 10, seed: DEFAULT_SEED });
const DEMO_DELAY_MS = 350;
const solverState = {
  available: false,
  moves: [],
  originalState: null,
  freeCellCardIds: new Set(),
  demoActive: false,
  demoTimer: null,
};

function cloneState(source) {
  return JSON.parse(JSON.stringify(source));
}

function restoreFromOriginal(originalState, currentState) {
  const restored = cloneState(originalState);
  if (currentState && currentState.cardsById) {
    Object.keys(restored.cardsById).forEach((cardId) => {
      if (currentState.cardsById[cardId]) {
        restored.cardsById[cardId].trapId = currentState.cardsById[cardId].trapId;
      }
    });
    restored.trapCount = currentState.trapCount;
    if (Array.isArray(currentState.freeCells)) {
      restored.freeCells.forEach((cell, index) => {
        if (currentState.freeCells[index]) {
          cell.name = currentState.freeCells[index].name;
        }
      });
    }
  }
  restored.pendingTrap = null;
  restored.freeCells.forEach((cell) => {
    cell.lock = null;
  });
  return restored;
}

function clearSolverState() {
  if (solverState.demoTimer) {
    clearTimeout(solverState.demoTimer);
  }
  solverState.available = false;
  solverState.moves = [];
  solverState.originalState = null;
  solverState.freeCellCardIds = new Set();
  solverState.demoActive = false;
  solverState.demoTimer = null;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function sendState(socket) {
  const role = socket.data.role || "player";
  const payload = game.serializeState(state, { role, socketId: socket.id });
  if (role === "dm") {
    payload.solver = {
      available: solverState.available,
      demoActive: solverState.demoActive,
    };
  }
  socket.emit("state", payload);
}

function broadcastState() {
  for (const socket of io.sockets.sockets.values()) {
    sendState(socket);
  }
}

function isFrozenForSocket(socket) {
  return state.pendingTrap && socket.data.role !== "dm";
}

io.on("connection", (socket) => {
  socket.data.role = "player";
  sendState(socket);

  socket.on("register", (payload) => {
    const requested = payload && payload.role === "dm" ? "dm" : "player";
    socket.data.role = requested;
    sendState(socket);
  });

  socket.on("startGame", (payload) => {
    if (socket.data.role !== "dm") {
      return;
    }
    const trapCount = game.normalizeTrapCount(payload && payload.trapCount);
    const seed = Number.isInteger(payload && payload.seed) ? payload.seed : DEFAULT_SEED;
    clearSolverState();
    state = game.createGame({ trapCount, seed });
    broadcastState();
  });

  socket.on("resetGame", () => {
    if (socket.data.role !== "dm") {
      return;
    }
    if (solverState.originalState) {
      state = restoreFromOriginal(solverState.originalState, state);
    } else {
      state = game.createGame({ trapCount: state.trapCount, seed: state.seed });
    }
    broadcastState();
  });

  socket.on("move", (move) => {
    if (solverState.demoActive) {
      socket.emit("actionError", { message: "Demo in progress. Please wait." });
      return;
    }
    if (state.pendingTrap) {
      socket.emit("actionError", {
        message: "A trap is active. Wait for the DM.",
      });
      return;
    }
    if (isFrozenForSocket(socket)) {
      socket.emit("actionError", {
        message: "A trap is active. Wait for the DM.",
      });
      return;
    }
    const result = game.applyMove(state, move);
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    if (result.trapTriggered) {
      for (const client of io.sockets.sockets.values()) {
        if (client.data.role === "dm") {
          client.emit("trapTriggered", { message: result.trapMessage });
        }
      }
    }
    broadcastState();
  });

  socket.on("freeCellLock", (payload) => {
    if (solverState.demoActive) {
      socket.emit("actionError", { message: "Demo in progress. Please wait." });
      return;
    }
    if (isFrozenForSocket(socket)) {
      socket.emit("actionError", { message: "A trap is active. Wait for the DM." });
      return;
    }
    const result = game.lockFreeCell(state, payload && payload.index, socket.id);
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    broadcastState();
  });

  socket.on("freeCellUnlock", (payload) => {
    if (solverState.demoActive) {
      socket.emit("actionError", { message: "Demo in progress. Please wait." });
      return;
    }
    const result = game.unlockFreeCell(state, payload && payload.index, socket.id);
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    broadcastState();
  });

  socket.on("freeCellName", (payload) => {
    if (solverState.demoActive) {
      socket.emit("actionError", { message: "Demo in progress. Please wait." });
      return;
    }
    if (isFrozenForSocket(socket)) {
      socket.emit("actionError", { message: "A trap is active. Wait for the DM." });
      return;
    }
    const result = game.setFreeCellName(
      state,
      payload && payload.index,
      payload && payload.name,
      socket.id
    );
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    broadcastState();
  });

  socket.on("resolveTrap", () => {
    if (socket.data.role !== "dm") {
      return;
    }
    if (!state.pendingTrap) {
      return;
    }
    state.pendingTrap = null;
    broadcastState();
  });

  socket.on("solveGame", () => {
    if (socket.data.role !== "dm") {
      return;
    }
    if (solverState.demoActive) {
      socket.emit("solverError", { message: "Demo already running." });
      return;
    }
    const snapshot = cloneState(state);
    snapshot.pendingTrap = null;
    snapshot.freeCells.forEach((cell) => {
      cell.lock = null;
    });
    clearSolverState();
    const result = solver.solveArcaneCells(snapshot);
    if (!result.ok) {
      broadcastState();
      socket.emit("solverError", { message: result.error });
      return;
    }
    solverState.available = true;
    solverState.moves = result.moves;
    solverState.originalState = snapshot;
    const freeCellCardIds = new Set();
    snapshot.freeCells.forEach((cell) => {
      if (cell.cardId) {
        freeCellCardIds.add(cell.cardId);
      }
    });
    result.moves.forEach((move) => {
      if (move.to && move.to.type === "freeCell") {
        freeCellCardIds.add(move.cardId);
      }
    });
    solverState.freeCellCardIds = freeCellCardIds;
    state = restoreFromOriginal(snapshot, state);
    broadcastState();
    socket.emit("solverResult", {
      moves: result.moves.length,
      nodes: result.nodes,
      elapsedMs: result.elapsedMs,
    });
  });

  socket.on("demoSolution", () => {
    if (socket.data.role !== "dm") {
      return;
    }
    if (!solverState.available || !solverState.originalState) {
      socket.emit("solverError", { message: "Solve the puzzle first." });
      return;
    }
    if (solverState.demoActive) {
      socket.emit("solverError", { message: "Demo already running." });
      return;
    }

    if (solverState.demoTimer) {
      clearTimeout(solverState.demoTimer);
      solverState.demoTimer = null;
    }
    solverState.demoActive = true;
    state = restoreFromOriginal(solverState.originalState, state);
    broadcastState();

    const runStep = (index) => {
      if (!solverState.demoActive) {
        return;
      }
      if (index >= solverState.moves.length) {
        solverState.demoActive = false;
        solverState.demoTimer = null;
        broadcastState();
        socket.emit("solverDemoComplete", { moves: solverState.moves.length });
        return;
      }
      const move = solverState.moves[index];
      const applied = game.applyMove(state, move, {
        ignoreFreeCellRules: true,
        ignoreTraps: true,
      });
      if (!applied.ok) {
        solverState.demoActive = false;
        solverState.demoTimer = null;
        broadcastState();
        socket.emit("solverError", {
          message: applied.error || "Demo move failed.",
        });
        return;
      }
      broadcastState();
      solverState.demoTimer = setTimeout(() => runStep(index + 1), DEMO_DELAY_MS);
    };

    runStep(0);
  });

  socket.on("reassignTraps", () => {
    if (socket.data.role !== "dm") {
      return;
    }
    if (!solverState.available) {
      socket.emit("solverError", { message: "Solve the puzzle first." });
      return;
    }
    if (solverState.demoActive) {
      socket.emit("solverError", { message: "Stop the demo before reassigning traps." });
      return;
    }
    const excluded = solverState.freeCellCardIds;
    const eligible = Object.keys(state.cardsById).filter((cardId) => !excluded.has(cardId));
    const targetCount = Math.min(state.trapCount, eligible.length);
    const nonAces = [];
    const aces = [];
    eligible.forEach((cardId) => {
      const card = state.cardsById[cardId];
      if (card && card.value === 1) {
        aces.push(cardId);
      } else {
        nonAces.push(cardId);
      }
    });
    shuffle(nonAces);
    shuffle(aces);
    const prioritizedEligible = nonAces.concat(aces);

    Object.values(state.cardsById).forEach((card) => {
      card.trapId = null;
    });
    prioritizedEligible.slice(0, targetCount).forEach((cardId, index) => {
      state.cardsById[cardId].trapId = index + 1;
    });
    state.trapCount = targetCount;
    state.pendingTrap = null;
    broadcastState();
    socket.emit("trapReassigned", { trapCount: targetCount });
  });

  socket.on("disconnect", () => {
    const changed = game.releaseLocksForSocket(state, socket.id);
    if (changed) {
      broadcastState();
    }
  });
});

const minesNamespace = io.of("/echoing-mines");
const MINES_DEFAULT_LEVEL = 1;
const MINES_HISTORY_LIMIT = 500;
const MINES_HISTORY_MONSTER_ERROR = "Undo/Redo is disabled while monsters are on the map.";
let minesState = minesGame.createGame({
  level: MINES_DEFAULT_LEVEL,
  seed: DEFAULT_SEED,
});
let minesDiskLoadedSnapshot = null;
const minesHistory = {
  undo: [],
  redo: [],
};

function minesHasMonsters() {
  return Array.isArray(minesState.monsters) && minesState.monsters.length > 0;
}

function clearMinesHistory() {
  minesHistory.undo = [];
  minesHistory.redo = [];
}

function enforceMinesHistoryAvailability() {
  if (minesHasMonsters()) {
    clearMinesHistory();
  }
}

function getMinesHistoryState() {
  const available = !minesHasMonsters();
  return {
    available,
    canUndo: available && minesHistory.undo.length > 0,
    canRedo: available && minesHistory.redo.length > 0,
  };
}

function pushMinesUndoState(snapshot) {
  if (minesHasMonsters()) {
    clearMinesHistory();
    return false;
  }
  minesHistory.undo.push(snapshot);
  if (minesHistory.undo.length > MINES_HISTORY_LIMIT) {
    minesHistory.undo.shift();
  }
  minesHistory.redo = [];
  return true;
}

function applyMinesUndo() {
  if (minesHasMonsters()) {
    return { ok: false, error: MINES_HISTORY_MONSTER_ERROR };
  }
  if (minesHistory.undo.length === 0) {
    return { ok: false, error: "Nothing to undo." };
  }
  minesHistory.redo.push(cloneState(minesState));
  if (minesHistory.redo.length > MINES_HISTORY_LIMIT) {
    minesHistory.redo.shift();
  }
  minesState = minesHistory.undo.pop();
  enforceMinesHistoryAvailability();
  return { ok: true };
}

function applyMinesRedo() {
  if (minesHasMonsters()) {
    return { ok: false, error: MINES_HISTORY_MONSTER_ERROR };
  }
  if (minesHistory.redo.length === 0) {
    return { ok: false, error: "Nothing to redo." };
  }
  minesHistory.undo.push(cloneState(minesState));
  if (minesHistory.undo.length > MINES_HISTORY_LIMIT) {
    minesHistory.undo.shift();
  }
  minesState = minesHistory.redo.pop();
  enforceMinesHistoryAvailability();
  return { ok: true };
}

function serializeMinesState(socket) {
  enforceMinesHistoryAvailability();
  const payload = minesGame.serializeState(minesState, {
    role: socket.data.role || "player",
    socketId: socket.id,
  });
  payload.history = getMinesHistoryState();
  return payload;
}

function sendMinesState(socket) {
  socket.emit("state", serializeMinesState(socket));
}

function broadcastMinesState() {
  for (const socket of minesNamespace.sockets.values()) {
    sendMinesState(socket);
  }
}

function broadcastMinesAnnouncement(message) {
  if (!message) {
    return;
  }
  minesNamespace.emit("announcement", { message });
}

function broadcastMinesSound(id) {
  if (!id) {
    return;
  }
  minesNamespace.emit("sound", { id });
}

function notifyMinesTrap(message) {
  for (const socket of minesNamespace.sockets.values()) {
    if (socket.data.role === "dm") {
      socket.emit("trapTriggered", { message });
    }
  }
}

function parseMinesLoadRequest(payload) {
  if (payload && payload.snapshot && Array.isArray(payload.snapshot.tiles)) {
    return {
      snapshot: payload.snapshot,
      source: payload.source,
    };
  }
  if (payload && Array.isArray(payload.tiles)) {
    return {
      snapshot: payload,
      source: null,
    };
  }
  return {
    snapshot: null,
    source: null,
  };
}

minesNamespace.on("connection", (socket) => {
  socket.data.role = "player";
  sendMinesState(socket);

  socket.on("register", (payload) => {
    const requested = payload && payload.role === "dm" ? "dm" : "player";
    socket.data.role = requested;
    sendMinesState(socket);
  });

  socket.on("startGame", (payload) => {
    if (socket.data.role !== "dm") {
      return;
    }
    const level = Math.max(
      1,
      Number.parseInt(payload && payload.level, 10) || MINES_DEFAULT_LEVEL
    );
    const seed = Number.isInteger(payload && payload.seed) ? payload.seed : DEFAULT_SEED;
    const preservedTokens = minesState.tokens.map((token) => ({
      id: token.id,
      name: token.name,
      ownerId: token.ownerId,
      gold: 0,
      items: [],
      avatar: token.avatar,
      initiativeMod: token.initiativeMod,
    }));
    minesState = minesGame.createGame({
      level,
      seed,
      tokens: preservedTokens,
      tokenCount: preservedTokens.length,
      monsterConfig: minesState.monsterConfig,
      fogEnabled: minesState.fogEnabled !== false,
    });
    minesDiskLoadedSnapshot = null;
    clearMinesHistory();
    enforceMinesHistoryAvailability();
    broadcastMinesState();
  });

  socket.on("resetGame", () => {
    if (socket.data.role !== "dm") {
      return;
    }
    if (minesDiskLoadedSnapshot) {
      const reloaded = minesGame.loadSnapshot(
        minesState,
        cloneState(minesDiskLoadedSnapshot)
      );
      if (reloaded) {
        minesState = reloaded;
      } else {
        minesDiskLoadedSnapshot = null;
        minesState = minesGame.resetLevel(minesState);
      }
    } else {
      minesState = minesGame.resetLevel(minesState);
    }
    clearMinesHistory();
    enforceMinesHistoryAvailability();
    broadcastMinesState();
  });

  socket.on("loadMap", (payload) => {
    if (socket.data.role !== "dm") {
      return;
    }
    const request = parseMinesLoadRequest(payload);
    const loaded = minesGame.loadSnapshot(minesState, request.snapshot);
    if (!loaded) {
      socket.emit("actionError", { message: "Could not load that map." });
      return;
    }
    minesState = loaded;
    minesDiskLoadedSnapshot =
      request.source === "disk-file" ? cloneState(request.snapshot) : null;
    clearMinesHistory();
    enforceMinesHistoryAvailability();
    broadcastMinesState();
  });

  socket.on("moveToken", (payload) => {
    const beforeMove = cloneState(minesState);
    const result = minesGame.applyMove(minesState, payload, {
      role: socket.data.role || "player",
      socketId: socket.id,
      now: Date.now(),
    });
    if (!result.ok) {
      if (result.announcement) {
        broadcastMinesAnnouncement(result.announcement);
      } else if (result.error) {
        socket.emit("actionError", { message: result.error });
      }
      return;
    }
    if (result.isStateAlteringAction) {
      pushMinesUndoState(beforeMove);
    }
    if (result.trapTriggered) {
      notifyMinesTrap(result.announcement || "A trap was triggered.");
    }
    if (result.announcement) {
      broadcastMinesAnnouncement(result.announcement);
    }
    if (result.sounds && result.sounds.length > 0) {
      result.sounds.forEach((id) => broadcastMinesSound(id));
    }
    if (result.reachedExit && result.allEscaped) {
      minesState = minesGame.advanceLevel(minesState);
      minesDiskLoadedSnapshot = null;
      enforceMinesHistoryAvailability();
      broadcastMinesAnnouncement(`Exit reached. Descending to level ${minesState.level}.`);
    }
    broadcastMinesState();
  });

  socket.on("moveMonster", (payload) => {
    const result = minesGame.applyMonsterMove(minesState, payload, {
      role: socket.data.role || "player",
      socketId: socket.id,
      now: Date.now(),
    });
    if (!result.ok) {
      if (result.announcement) {
        broadcastMinesAnnouncement(result.announcement);
      } else if (result.error) {
        socket.emit("actionError", { message: result.error });
      }
      return;
    }
    if (result.announcement) {
      broadcastMinesAnnouncement(result.announcement);
    }
    if (result.sounds && result.sounds.length > 0) {
      result.sounds.forEach((id) => broadcastMinesSound(id));
    }
    broadcastMinesState();
  });

  socket.on("setTokenName", (payload) => {
    const result = minesGame.setTokenName(
      minesState,
      payload && payload.tokenId,
      payload && payload.name,
      socket.id,
      socket.data.role || "player"
    );
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    broadcastMinesState();
  });

  socket.on("setTokenAvatar", (payload) => {
    const result = minesGame.setTokenAvatar(
      minesState,
      payload && payload.tokenId,
      payload && payload.avatar,
      socket.id,
      socket.data.role || "player"
    );
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    broadcastMinesState();
  });

  socket.on("setTokenInitiativeMod", (payload) => {
    const result = minesGame.setTokenInitiativeMod(
      minesState,
      payload && payload.tokenId,
      payload && payload.initiativeMod,
      socket.id,
      socket.data.role || "player"
    );
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    broadcastMinesState();
  });

  socket.on("setMonsterConfig", (payload) => {
    const result = minesGame.setMonsterConfig(
      minesState,
      payload && payload.type,
      payload,
      socket.data.role || "player"
    );
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    broadcastMinesState();
  });

  socket.on("setFogOfWar", (payload) => {
    const result = minesGame.setFogOfWar(
      minesState,
      payload && payload.enabled,
      socket.data.role || "player"
    );
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    broadcastMinesState();
  });

  socket.on("editMapTile", (payload) => {
    const result = minesGame.editMapTile(
      minesState,
      payload,
      socket.data.role || "player"
    );
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    clearMinesHistory();
    enforceMinesHistoryAvailability();
    broadcastMinesState();
  });

  socket.on("setCombatInitiative", (payload) => {
    const result = minesGame.setCombatInitiative(
      minesState,
      payload && payload.entryId,
      payload && payload.initiative,
      socket.id,
      socket.data.role || "player"
    );
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    broadcastMinesState();
  });

  socket.on("resortCombat", () => {
    const result = minesGame.resortCombat(minesState, socket.data.role || "player");
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    broadcastMinesState();
  });

  socket.on("advanceCombat", () => {
    const result = minesGame.advanceCombatTurn(minesState, socket.data.role || "player", {
      direction: 1,
    });
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    if (result.events && result.events.length > 0) {
      result.events.forEach((event) => {
        if (event.type === "announcement") {
          broadcastMinesAnnouncement(event.message);
        }
      });
    }
    if (result.sounds && result.sounds.length > 0) {
      result.sounds.forEach((id) => broadcastMinesSound(id));
    }
    broadcastMinesState();
  });

  socket.on("retreatCombat", () => {
    const result = minesGame.advanceCombatTurn(minesState, socket.data.role || "player", {
      direction: -1,
    });
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    broadcastMinesState();
  });

  socket.on("addMonsterToCombat", (payload) => {
    const result = minesGame.addMonsterToCombat(
      minesState,
      payload && payload.monsterId,
      socket.data.role || "player"
    );
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    broadcastMinesState();
  });

  socket.on("deleteMonster", (payload) => {
    const result = minesGame.deleteMonster(
      minesState,
      payload && payload.monsterId,
      socket.data.role || "player"
    );
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    broadcastMinesState();
  });

  socket.on("exitCombat", () => {
    const result = minesGame.exitCombat(minesState, socket.data.role || "player");
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    broadcastMinesState();
  });

  socket.on("resolveTrap", () => {
    if (socket.data.role !== "dm") {
      return;
    }
    if (!minesState.pendingTrap) {
      return;
    }
    minesState.pendingTrap = null;
    broadcastMinesState();
  });

  socket.on("undoAction", () => {
    const result = applyMinesUndo();
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    broadcastMinesState();
  });

  socket.on("redoAction", () => {
    const result = applyMinesRedo();
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    broadcastMinesState();
  });

  socket.on("disconnect", () => {
    const changed = minesGame.releaseTokenOwnership(minesState, socket.id);
    if (changed) {
      broadcastMinesState();
    }
  });
});

const MINES_TICK_MS = 100;
setInterval(() => {
  const result = minesGame.updateMonsters(minesState, { now: Date.now() });
  if (result.events && result.events.length > 0) {
    result.events.forEach((event) => {
      if (event.type === "announcement") {
        broadcastMinesAnnouncement(event.message);
      }
    });
  }
  if (result.sounds && result.sounds.length > 0) {
    result.sounds.forEach((id) => broadcastMinesSound(id));
  }
  if (result.changed) {
    broadcastMinesState();
  }
}, MINES_TICK_MS);

server.listen(PORT, HOST, () => {
  console.log(`DnD minigames server running on http://${HOST}:${PORT}`);
});
