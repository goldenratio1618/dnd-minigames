const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const game = require("./game/arcane-cells");

const PORT = Number.parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
app.set("trust proxy", false);

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

app.use(privateOnly);
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

let state = game.createGame({ trapCount: 10 });

function sendState(socket) {
  const role = socket.data.role || "player";
  socket.emit("state", game.serializeState(state, { role, socketId: socket.id }));
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
    state = game.createGame({ trapCount });
    broadcastState();
  });

  socket.on("move", (move) => {
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
    const result = game.unlockFreeCell(state, payload && payload.index, socket.id);
    if (!result.ok) {
      socket.emit("actionError", { message: result.error });
      return;
    }
    broadcastState();
  });

  socket.on("freeCellName", (payload) => {
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

  socket.on("disconnect", () => {
    const changed = game.releaseLocksForSocket(state, socket.id);
    if (changed) {
      broadcastState();
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`DnD minigames server running on http://${HOST}:${PORT}`);
});
