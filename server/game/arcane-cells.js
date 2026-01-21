const COLORS = ["white", "green", "blue", "black"];
const FOUNDATION_COLORS = ["white", "green", "blue", "black"];
const COLOR_GROUP = {
  white: "light",
  green: "light",
  blue: "dark",
  black: "dark",
};

function createDeck() {
  const deck = [];
  let idCounter = 1;
  for (const color of COLORS) {
    for (let value = 1; value <= 13; value += 1) {
      deck.push({
        id: `c${idCounter}`,
        color,
        value,
        trapId: null,
      });
      idCounter += 1;
    }
  }
  return deck;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

function normalizeTrapCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return 10;
  }
  return Math.max(0, Math.min(52, parsed));
}

function dealTableau(deck) {
  const tableau = Array.from({ length: 8 }, () => []);
  let deckIndex = 0;
  for (let col = 0; col < tableau.length; col += 1) {
    const targetCount = col < 4 ? 7 : 6;
    for (let i = 0; i < targetCount; i += 1) {
      tableau[col].push(deck[deckIndex].id);
      deckIndex += 1;
    }
  }
  return tableau;
}

function assignTraps(deck, trapCount) {
  const selection = shuffle(deck.map((card) => card.id)).slice(
    0,
    Math.min(trapCount, deck.length)
  );
  selection.forEach((cardId, index) => {
    const card = deck.find((entry) => entry.id === cardId);
    if (card) {
      card.trapId = index + 1;
    }
  });
  return selection.length;
}

function createGame({ trapCount = 10 } = {}) {
  const deck = shuffle(createDeck());
  const cardsById = {};
  for (const card of deck) {
    cardsById[card.id] = card;
  }

  const safeTrapCount = normalizeTrapCount(trapCount);
  const assignedTrapCount = assignTraps(deck, safeTrapCount);

  return {
    gameId: "arcane-cells",
    name: "Arcane Cells",
    trapCount: assignedTrapCount,
    cardsById,
    tableau: dealTableau(deck),
    freeCells: Array.from({ length: 4 }, () => ({
      cardId: null,
      name: "",
      lock: null,
    })),
    foundations: {
      white: [],
      green: [],
      blue: [],
      black: [],
    },
    pendingTrap: null,
  };
}

function buildCardPositions(state) {
  const positions = new Map();
  state.freeCells.forEach((cell, index) => {
    if (cell.cardId) {
      positions.set(cell.cardId, { col: index, row: -2 });
    }
  });

  FOUNDATION_COLORS.forEach((color, index) => {
    const pile = state.foundations[color];
    if (pile.length > 0) {
      positions.set(pile[pile.length - 1], { col: index + 4, row: -2 });
    }
  });

  state.tableau.forEach((column, colIndex) => {
    column.forEach((cardId, rowIndex) => {
      positions.set(cardId, { col: colIndex, row: rowIndex });
    });
  });

  return positions;
}

function computeAdjacencyCounts(state) {
  const positions = buildCardPositions(state);
  const counts = {};
  const entries = Array.from(positions.entries());

  for (const [cardId, pos] of entries) {
    let count = 0;
    for (const [otherId, otherPos] of entries) {
      if (
        Math.abs(pos.col - otherPos.col) <= 1 &&
        Math.abs(pos.row - otherPos.row) <= 1
      ) {
        const otherCard = state.cardsById[otherId];
        if (otherCard && otherCard.trapId) {
          count += 1;
        }
      }
    }
    counts[cardId] = count;
  }

  return counts;
}

function serializeCard(card, counts, role) {
  return {
    id: card.id,
    color: card.color,
    value: card.value,
    hint: counts[card.id] || 0,
    trapId: role === "dm" ? card.trapId : null,
    isTrap: role === "dm" ? Boolean(card.trapId) : false,
  };
}

function serializeState(state, { role, socketId }) {
  const counts = computeAdjacencyCounts(state);

  return {
    gameId: state.gameId,
    gameName: state.name,
    trapCount: state.trapCount,
    pendingTrap: state.pendingTrap
      ? role === "dm"
        ? {
            active: true,
            trapId: state.pendingTrap.trapId,
            triggeredBy: state.pendingTrap.triggeredByName,
            message: `Trap #${state.pendingTrap.trapId} triggered by ${state.pendingTrap.triggeredByName}`,
          }
        : { active: true }
      : null,
    freeCells: state.freeCells.map((cell) => ({
      name: cell.name,
      locked: Boolean(cell.lock),
      lockOwner: cell.lock === socketId,
      card: cell.cardId
        ? serializeCard(state.cardsById[cell.cardId], counts, role)
        : null,
    })),
    foundations: FOUNDATION_COLORS.map((color) => {
      const pile = state.foundations[color];
      const topCard = pile.length > 0 ? state.cardsById[pile[pile.length - 1]] : null;
      return {
        color,
        count: pile.length,
        topCard: topCard ? serializeCard(topCard, counts, role) : null,
      };
    }),
    tableau: state.tableau.map((column) =>
      column.map((cardId) => serializeCard(state.cardsById[cardId], counts, role))
    ),
  };
}

function canPlaceOnTableau(card, destCard) {
  return (
    COLOR_GROUP[card.color] !== COLOR_GROUP[destCard.color] &&
    card.value + 1 === destCard.value
  );
}

function canPlaceOnFoundation(card, pileIds, cardsById) {
  if (pileIds.length === 0) {
    return card.value === 1;
  }
  const topCard = cardsById[pileIds[pileIds.length - 1]];
  return card.value === topCard.value + 1;
}

function applyMove(state, move) {
  if (!move || !move.from || !move.to) {
    return { ok: false, error: "Move is missing source or destination." };
  }

  const from = move.from;
  const to = move.to;

  if (from.type === "foundation") {
    return { ok: false, error: "Cards cannot be moved out of the foundation." };
  }

  let stack = [];
  if (from.type === "tableau") {
    if (!Number.isInteger(from.index) || from.index < 0 || from.index >= state.tableau.length) {
      return { ok: false, error: "Invalid tableau column." };
    }
    if (!move.cardId) {
      return { ok: false, error: "Select a card to move." };
    }
    const column = state.tableau[from.index];
    if (!column.includes(move.cardId)) {
      return { ok: false, error: "That card is not in the selected column." };
    }
    if (column[column.length - 1] !== move.cardId) {
      return { ok: false, error: "Only the top card can be moved." };
    }
    stack = [move.cardId];
  } else if (from.type === "freeCell") {
    if (!Number.isInteger(from.index) || from.index < 0 || from.index >= state.freeCells.length) {
      return { ok: false, error: "Invalid free cell." };
    }
    const cell = state.freeCells[from.index];
    if (!cell.cardId) {
      return { ok: false, error: "That free cell is empty." };
    }
    stack = [cell.cardId];
  } else {
    return { ok: false, error: "Invalid source pile." };
  }

  if (stack.length === 0) {
    return { ok: false, error: "No cards selected." };
  }

  if (to.type === "tableau") {
    if (!Number.isInteger(to.index) || to.index < 0 || to.index >= state.tableau.length) {
      return { ok: false, error: "Invalid tableau column." };
    }
    if (from.type === "tableau" && from.index === to.index) {
      return { ok: false, error: "Select a different column." };
    }

    const destination = state.tableau[to.index];
    if (destination.length > 0) {
      const destCard = state.cardsById[destination[destination.length - 1]];
      const movingCard = state.cardsById[stack[0]];
      if (!canPlaceOnTableau(movingCard, destCard)) {
        return { ok: false, error: "That column cannot accept the selected card." };
      }
    }

    if (from.type === "tableau") {
      const column = state.tableau[from.index];
      column.splice(column.length - stack.length, stack.length);
    } else if (from.type === "freeCell") {
      state.freeCells[from.index].cardId = null;
    }

    destination.push(...stack);
    return { ok: true };
  }

  if (to.type === "foundation") {
    if (stack.length !== 1) {
      return { ok: false, error: "Only single cards can move to the foundation." };
    }
    if (!Number.isInteger(to.index) || to.index < 0 || to.index >= FOUNDATION_COLORS.length) {
      return { ok: false, error: "Invalid foundation pile." };
    }
    const color = FOUNDATION_COLORS[to.index];
    const card = state.cardsById[stack[0]];
    if (card.color !== color) {
      return { ok: false, error: "That foundation is for a different color." };
    }
    const pile = state.foundations[color];
    if (!canPlaceOnFoundation(card, pile, state.cardsById)) {
      return { ok: false, error: "That card does not fit on the foundation." };
    }

    if (from.type === "tableau") {
      const column = state.tableau[from.index];
      column.splice(column.length - 1, 1);
    } else if (from.type === "freeCell") {
      state.freeCells[from.index].cardId = null;
    }

    pile.push(card.id);
    return { ok: true };
  }

  if (to.type === "freeCell") {
    if (stack.length !== 1) {
      return { ok: false, error: "Only single cards can move to a free cell." };
    }
    if (!Number.isInteger(to.index) || to.index < 0 || to.index >= state.freeCells.length) {
      return { ok: false, error: "Invalid free cell." };
    }
    const cell = state.freeCells[to.index];
    if (cell.cardId) {
      return { ok: false, error: "That free cell already has a card." };
    }
    if (cell.lock) {
      return { ok: false, error: "That free cell is being edited." };
    }
    if (!cell.name.trim()) {
      return { ok: false, error: "A character must stand in that free cell." };
    }

    if (from.type === "tableau") {
      const column = state.tableau[from.index];
      column.splice(column.length - 1, 1);
    } else if (from.type === "freeCell") {
      state.freeCells[from.index].cardId = null;
    }

    const card = state.cardsById[stack[0]];
    cell.cardId = card.id;

    if (card.trapId) {
      const triggeredTrap = card.trapId;
      card.trapId = null;
      state.pendingTrap = {
        trapId: triggeredTrap,
        triggeredByName: cell.name.trim(),
        cardId: card.id,
        freeCellIndex: to.index,
      };
      return {
        ok: true,
        trapTriggered: true,
        trapMessage: `Trap #${triggeredTrap} triggered by ${cell.name.trim()}`,
      };
    }

    return { ok: true };
  }

  return { ok: false, error: "Invalid destination pile." };
}

function lockFreeCell(state, index, socketId) {
  if (!Number.isInteger(index) || index < 0 || index >= state.freeCells.length) {
    return { ok: false, error: "Invalid free cell." };
  }
  const cell = state.freeCells[index];
  if (cell.lock && cell.lock !== socketId) {
    return { ok: false, error: "That free cell is being edited." };
  }
  cell.lock = socketId;
  return { ok: true };
}

function unlockFreeCell(state, index, socketId) {
  if (!Number.isInteger(index) || index < 0 || index >= state.freeCells.length) {
    return { ok: false, error: "Invalid free cell." };
  }
  const cell = state.freeCells[index];
  if (cell.lock && cell.lock !== socketId) {
    return { ok: false, error: "Only the active editor can unlock this cell." };
  }
  cell.lock = null;
  return { ok: true };
}

function setFreeCellName(state, index, name, socketId) {
  if (!Number.isInteger(index) || index < 0 || index >= state.freeCells.length) {
    return { ok: false, error: "Invalid free cell." };
  }
  const cell = state.freeCells[index];
  if (cell.lock && cell.lock !== socketId) {
    return { ok: false, error: "You do not hold the edit lock." };
  }
  const trimmed = String(name || "").trim();
  if (trimmed.length > 24) {
    return { ok: false, error: "Name is too long." };
  }
  if (!trimmed && cell.cardId) {
    return { ok: false, error: "Remove the card before clearing the name." };
  }
  cell.name = trimmed;
  return { ok: true };
}

function releaseLocksForSocket(state, socketId) {
  let released = false;
  state.freeCells.forEach((cell) => {
    if (cell.lock === socketId) {
      cell.lock = null;
      released = true;
    }
  });
  return released;
}

module.exports = {
  FOUNDATION_COLORS,
  createGame,
  serializeState,
  applyMove,
  lockFreeCell,
  unlockFreeCell,
  setFreeCellName,
  releaseLocksForSocket,
  normalizeTrapCount,
};
