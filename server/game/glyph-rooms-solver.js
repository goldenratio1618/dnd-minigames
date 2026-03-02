const glyphRooms = require("./glyph-rooms");

const MAX_HP = 20;

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function glyphCode(glyph) {
  if (!glyph) {
    return "";
  }
  if (glyph.type === "green") {
    return `g${glyph.value}:${glyph.guard}`;
  }
  return `${glyph.type[0]}${glyph.value}`;
}

function encodeState(state) {
  const equipped = state.equippedGreen
    ? `${state.equippedGreen.value}:${state.equippedGreen.guard}`
    : "-";
  const room = state.room.map((glyph) => glyphCode(glyph)).sort().join(",");
  const deck = state.deck.map((glyph) => glyphCode(glyph)).join(",");
  return [
    state.roomClicks,
    state.roomWhiteTriggered ? 1 : 0,
    state.blueActive ? 1 : 0,
    equipped,
    room,
    deck,
  ].join("|");
}

function isSolved(state) {
  return state.deck.length === 0 && state.room.length === 0;
}

function canUseBlock(state, glyph) {
  return Boolean(
    glyph &&
      glyph.type === "black" &&
      state.equippedGreen &&
      state.equippedGreen.guard > glyph.value
  );
}

function generateActions(state, allowBlueGlyph) {
  const actions = [];

  const whiteActions = [];
  const greenActions = [];
  const blackBlockActions = [];
  const blackRawActions = [];

  state.room.forEach((glyph) => {
    if (glyph.type === "white") {
      whiteActions.push({
        type: "clickGlyph",
        glyphId: glyph.id,
        useBlock: false,
      });
      return;
    }
    if (glyph.type === "green") {
      greenActions.push({
        type: "clickGlyph",
        glyphId: glyph.id,
        useBlock: false,
      });
      return;
    }
    if (glyph.type === "black") {
      if (canUseBlock(state, glyph)) {
        blackBlockActions.push({
          type: "clickGlyph",
          glyphId: glyph.id,
          useBlock: true,
        });
      }
      blackRawActions.push({
        type: "clickGlyph",
        glyphId: glyph.id,
        useBlock: false,
      });
    }
  });

  if (allowBlueGlyph && state.blueActive && state.room.length === 4) {
    actions.push({ type: "useBlueGlyph" });
  }

  if (!state.roomWhiteTriggered) {
    actions.push(...whiteActions);
  }
  actions.push(...greenActions);
  actions.push(...blackBlockActions);
  actions.push(...blackRawActions);
  if (state.roomWhiteTriggered) {
    actions.push(...whiteActions);
  }

  return actions;
}

function applyAction(state, action) {
  if (action.type === "useBlueGlyph") {
    return glyphRooms.useBlueGlyph(state);
  }
  if (action.type === "clickGlyph") {
    return glyphRooms.clickGlyph(state, {
      glyphId: action.glyphId,
      useBlock: action.useBlock,
    });
  }
  return { ok: false, error: "Unknown action." };
}

function serializeMove(action) {
  if (action.type === "useBlueGlyph") {
    return { type: "useBlueGlyph" };
  }
  return {
    type: "clickGlyph",
    glyphId: action.glyphId,
    useBlock: Boolean(action.useBlock),
  };
}

function solveGlyphRooms(gameState, options = {}) {
  const started = Boolean(gameState && gameState.started);
  if (!started) {
    return { ok: false, error: "Game has not started.", moves: [], nodes: 0, elapsedMs: 0 };
  }

  const initial = cloneState(gameState);
  const maxNodes = Number.isInteger(options.maxNodes) ? options.maxNodes : 1200000;
  const maxTimeMs = Number.isInteger(options.maxTimeMs) ? options.maxTimeMs : 20000;
  const allowBlueGlyph = Boolean(options.allowBlueGlyph);
  const startedAt = Date.now();

  const bestHpByKey = new Map();
  const path = [];
  let nodes = 0;
  let solved = false;
  let timeout = false;
  let nodeLimit = false;

  function dfs(state) {
    if (solved || timeout || nodeLimit) {
      return;
    }
    if (Date.now() - startedAt > maxTimeMs) {
      timeout = true;
      return;
    }
    if (nodes >= maxNodes) {
      nodeLimit = true;
      return;
    }

    nodes += 1;

    if (isSolved(state)) {
      solved = true;
      return;
    }
    if (state.hp <= 0) {
      return;
    }

    const key = encodeState(state);
    const knownHp = bestHpByKey.get(key);
    if (knownHp !== undefined && knownHp >= state.hp) {
      return;
    }
    bestHpByKey.set(key, Math.min(MAX_HP, state.hp));

    const actions = generateActions(state, allowBlueGlyph);
    for (const action of actions) {
      const next = cloneState(state);
      const result = applyAction(next, action);
      if (!result.ok) {
        continue;
      }
      path.push(serializeMove(action));
      dfs(next);
      if (solved || timeout || nodeLimit) {
        return;
      }
      path.pop();
    }
  }

  dfs(initial);

  if (solved) {
    return {
      ok: true,
      moves: path.slice(),
      nodes,
      elapsedMs: Date.now() - startedAt,
    };
  }
  if (timeout) {
    return {
      ok: false,
      error: "Solver timed out before finding a full clear.",
      moves: [],
      nodes,
      elapsedMs: Date.now() - startedAt,
    };
  }
  if (nodeLimit) {
    return {
      ok: false,
      error: "Solver reached the search limit before finding a full clear.",
      moves: [],
      nodes,
      elapsedMs: Date.now() - startedAt,
    };
  }
  return {
    ok: false,
    error: "Solver could not find a full clear.",
    moves: [],
    nodes,
    elapsedMs: Date.now() - startedAt,
  };
}

module.exports = {
  solveGlyphRooms,
};
