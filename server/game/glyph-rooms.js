const WHITE_RANGE = { min: 2, max: 10 };
const BLACK_RANGE = { min: 2, max: 14 };
const GREEN_RANGE = { min: 2, max: 10 };
const GREEN_START_GUARD = 15;
const STARTING_HP_CAP = 20;

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function drawGlyphs(state, count) {
  if (!Number.isInteger(count) || count <= 0) {
    return [];
  }
  return state.deck.splice(0, Math.min(count, state.deck.length));
}

function createGlyphPool() {
  const glyphs = [];
  let idCounter = 1;

  for (let value = WHITE_RANGE.min; value <= WHITE_RANGE.max; value += 1) {
    glyphs.push({
      id: `g${idCounter}`,
      type: "white",
      value,
    });
    idCounter += 1;
  }

  for (let value = BLACK_RANGE.min; value <= BLACK_RANGE.max; value += 1) {
    glyphs.push({
      id: `g${idCounter}`,
      type: "black",
      value,
    });
    idCounter += 1;
    glyphs.push({
      id: `g${idCounter}`,
      type: "black",
      value,
    });
    idCounter += 1;
  }

  for (let value = GREEN_RANGE.min; value <= GREEN_RANGE.max; value += 1) {
    glyphs.push({
      id: `g${idCounter}`,
      type: "green",
      value,
      guard: GREEN_START_GUARD,
    });
    idCounter += 1;
  }

  return glyphs;
}

function normalizeMaxHp(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    return null;
  }
  if (parsed <= 0) {
    return null;
  }
  return Math.min(parsed, 9999);
}

function createGame() {
  return {
    gameId: "glyph-rooms",
    name: "Glyph Rooms",
    started: false,
    maxHp: null,
    hp: null,
    deck: [],
    room: [],
    equippedGreen: null,
    roomClicks: 0,
    roomWhiteTriggered: false,
    blueActive: true,
    roomIndex: 0,
  };
}

function isFinished(state) {
  if (!state.started) {
    return false;
  }
  if (state.hp <= 0) {
    return true;
  }
  return state.deck.length === 0 && state.room.length === 0;
}

function advanceRoomNormally(state) {
  const nextGlyphs = drawGlyphs(state, 3);
  state.room.push(...nextGlyphs);
  state.roomClicks = 0;
  state.roomWhiteTriggered = false;
  state.roomIndex += 1;
  if (!state.blueActive) {
    state.blueActive = true;
  }
}

function startGame(state, maxHpInput) {
  const currentHp = normalizeMaxHp(maxHpInput);
  if (!currentHp) {
    return { ok: false, error: "Invalid HP." };
  }

  state.started = true;
  state.maxHp = STARTING_HP_CAP;
  state.hp = Math.min(currentHp, STARTING_HP_CAP);
  state.deck = shuffle(createGlyphPool());
  state.room = drawGlyphs(state, 4);
  state.equippedGreen = null;
  state.roomClicks = 0;
  state.roomWhiteTriggered = false;
  state.blueActive = true;
  state.roomIndex = 1;
  return { ok: true };
}

function clickGlyph(state, payload) {
  if (!state.started) {
    return { ok: false, error: "Start the game first." };
  }
  if (isFinished(state)) {
    return { ok: false, error: "The run has ended." };
  }
  if (state.roomClicks >= 3) {
    return { ok: false, error: "Room is already complete." };
  }

  const glyphId = payload && payload.glyphId ? String(payload.glyphId) : "";
  const glyphIndex = state.room.findIndex((glyph) => glyph.id === glyphId);
  if (glyphIndex < 0) {
    return { ok: false, error: "Unknown glyph." };
  }

  const glyph = state.room[glyphIndex];
  if (glyph.type === "white") {
    if (!state.roomWhiteTriggered) {
      state.hp = Math.min(state.maxHp, state.hp + glyph.value);
      state.roomWhiteTriggered = true;
    }
    state.room.splice(glyphIndex, 1);
  } else if (glyph.type === "black") {
    const wantsBlock = Boolean(payload && payload.useBlock);
    const canBlock = Boolean(
      state.equippedGreen && state.equippedGreen.guard > glyph.value
    );
    if (wantsBlock && !canBlock) {
      return { ok: false, error: "That block is not available." };
    }

    let damage = glyph.value;
    if (wantsBlock && state.equippedGreen) {
      damage = Math.max(0, glyph.value - state.equippedGreen.value);
      state.equippedGreen.guard = glyph.value;
    }
    state.hp = Math.max(0, state.hp - damage);
    state.room.splice(glyphIndex, 1);
  } else if (glyph.type === "green") {
    state.equippedGreen = {
      type: "green",
      value: glyph.value,
      guard: glyph.guard,
    };
    state.room.splice(glyphIndex, 1);
  } else {
    return { ok: false, error: "Unknown glyph type." };
  }

  state.roomClicks += 1;
  if (state.roomClicks >= 3 || state.room.length === 0) {
    advanceRoomNormally(state);
  }

  return { ok: true };
}

function useBlueGlyph(state) {
  if (!state.started) {
    return { ok: false, error: "Start the game first." };
  }
  if (isFinished(state)) {
    return { ok: false, error: "The run has ended." };
  }
  if (!state.blueActive) {
    return { ok: false, error: "Blue glyph is inactive." };
  }
  if (state.room.length !== 4) {
    return { ok: false, error: "Blue glyph can only be used in a full room." };
  }

  if (state.room.length > 0) {
    const shuffledRoom = shuffle(state.room);
    state.deck.push(...shuffledRoom);
  }

  state.room = drawGlyphs(state, 4);
  state.roomClicks = 0;
  state.roomWhiteTriggered = false;
  state.blueActive = false;
  state.roomIndex += 1;
  return { ok: true };
}

function serializeGlyph(glyph) {
  return {
    id: glyph.id,
    type: glyph.type,
    value: glyph.value,
    guard: glyph.type === "green" ? glyph.guard : null,
  };
}

function serializeState(state) {
  return {
    gameId: state.gameId,
    gameName: state.name,
    started: state.started,
    hp: state.hp,
    maxHp: state.maxHp,
    roomIndex: state.roomIndex,
    roomClicks: state.roomClicks,
    blueActive: state.blueActive,
    deckCount: state.deck.length,
    room: state.room.map((glyph) => serializeGlyph(glyph)),
    equippedGreen: state.equippedGreen
      ? {
          value: state.equippedGreen.value,
          guard: state.equippedGreen.guard,
        }
      : null,
    finished: isFinished(state),
  };
}

module.exports = {
  createGame,
  startGame,
  clickGlyph,
  useBlueGlyph,
  serializeState,
  normalizeMaxHp,
};
