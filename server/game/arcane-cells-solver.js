const { FOUNDATION_COLORS } = require("./arcane-cells");

const COLOR_GROUP = {
  white: "light",
  green: "light",
  blue: "dark",
  black: "dark",
};

const FOUNDATION_INDEX = FOUNDATION_COLORS.reduce((acc, color, index) => {
  acc[color] = index;
  return acc;
}, {});

class MinHeap {
  constructor(compare) {
    this.items = [];
    this.compare = compare;
  }

  size() {
    return this.items.length;
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

  bubbleUp(index) {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.compare(this.items[current], this.items[parent]) >= 0) {
        break;
      }
      [this.items[current], this.items[parent]] = [this.items[parent], this.items[current]];
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
      [this.items[current], this.items[smallest]] = [this.items[smallest], this.items[current]];
      current = smallest;
    }
  }
}

function buildContext(gameState) {
  const cardIds = Object.keys(gameState.cardsById).sort((a, b) => {
    const aNum = Number.parseInt(a.slice(1), 10);
    const bNum = Number.parseInt(b.slice(1), 10);
    return aNum - bNum;
  });
  const cardIndexById = {};
  const cardIdByIndex = [];
  const cardColor = [];
  const cardValue = [];

  cardIds.forEach((id, index) => {
    const card = gameState.cardsById[id];
    cardIndexById[id] = index;
    cardIdByIndex[index] = id;
    cardColor[index] = card.color;
    cardValue[index] = card.value;
  });

  return {
    cardIndexById,
    cardIdByIndex,
    cardColor,
    cardValue,
    totalCards: cardIds.length,
  };
}

function buildSolverState(gameState, context) {
  return {
    tableau: gameState.tableau.map((column) =>
      column.map((cardId) => context.cardIndexById[cardId])
    ),
    freeCells: gameState.freeCells.map((cell) =>
      cell.cardId ? context.cardIndexById[cell.cardId] : -1
    ),
    foundations: FOUNDATION_COLORS.map((color) => gameState.foundations[color].length),
  };
}

function encodeState(state) {
  const foundationPart = state.foundations.join(",");
  const freePart = state.freeCells.slice().sort((a, b) => a - b).join(",");
  const tableauPart = state.tableau.map((column) => column.join(".")).join("|");
  return `${foundationPart}/${freePart}/${tableauPart}`;
}

function canPlaceOnTableau(cardIndex, destCardIndex, context) {
  const cardColor = context.cardColor[cardIndex];
  const destColor = context.cardColor[destCardIndex];
  const cardValue = context.cardValue[cardIndex];
  const destValue = context.cardValue[destCardIndex];
  return COLOR_GROUP[cardColor] !== COLOR_GROUP[destColor] && cardValue + 1 === destValue;
}

function canPlaceOnFoundation(cardIndex, foundations, context) {
  const color = context.cardColor[cardIndex];
  const foundationIndex = FOUNDATION_INDEX[color];
  const neededValue = foundations[foundationIndex] + 1;
  return context.cardValue[cardIndex] === neededValue;
}

function isSafeFoundationMove(cardIndex, foundations, context) {
  if (!canPlaceOnFoundation(cardIndex, foundations, context)) {
    return false;
  }
  const color = context.cardColor[cardIndex];
  const group = COLOR_GROUP[color];
  const [oppOne, oppTwo] =
    group === "light" ? ["blue", "black"] : ["white", "green"];
  const minOpp = Math.min(
    foundations[FOUNDATION_INDEX[oppOne]],
    foundations[FOUNDATION_INDEX[oppTwo]]
  );
  return context.cardValue[cardIndex] <= minOpp + 1;
}

function isInverseMove(move, lastMove) {
  if (!lastMove) {
    return false;
  }
  return (
    move.cardIndex === lastMove.cardIndex &&
    move.fromType === lastMove.toType &&
    move.fromIndex === lastMove.toIndex &&
    move.toType === lastMove.fromType &&
    move.toIndex === lastMove.fromIndex
  );
}

function generateMoves(state, context, lastMove) {
  const moves = [];
  const emptyFreeIndex = state.freeCells.indexOf(-1);
  const emptyTableauIndices = [];

  state.tableau.forEach((column, index) => {
    if (column.length === 0) {
      emptyTableauIndices.push(index);
    }
  });

  const firstEmptyTableau = emptyTableauIndices.length > 0 ? emptyTableauIndices[0] : -1;

  state.freeCells.forEach((cardIndex, cellIndex) => {
    if (cardIndex === -1) {
      return;
    }
    if (canPlaceOnFoundation(cardIndex, state.foundations, context)) {
      const move = {
        cardIndex,
        fromType: "freeCell",
        fromIndex: cellIndex,
        toType: "foundation",
        toIndex: FOUNDATION_INDEX[context.cardColor[cardIndex]],
      };
      if (!isInverseMove(move, lastMove)) {
        moves.push(move);
      }
    }
  });

  state.tableau.forEach((column, columnIndex) => {
    if (column.length === 0) {
      return;
    }
    const cardIndex = column[column.length - 1];
    if (canPlaceOnFoundation(cardIndex, state.foundations, context)) {
      const move = {
        cardIndex,
        fromType: "tableau",
        fromIndex: columnIndex,
        toType: "foundation",
        toIndex: FOUNDATION_INDEX[context.cardColor[cardIndex]],
      };
      if (!isInverseMove(move, lastMove)) {
        moves.push(move);
      }
    }
  });

  state.freeCells.forEach((cardIndex, cellIndex) => {
    if (cardIndex === -1) {
      return;
    }
    state.tableau.forEach((column, columnIndex) => {
      if (column.length === 0) {
        if (columnIndex !== firstEmptyTableau) {
          return;
        }
        const move = {
          cardIndex,
          fromType: "freeCell",
          fromIndex: cellIndex,
          toType: "tableau",
          toIndex: columnIndex,
        };
        if (!isInverseMove(move, lastMove)) {
          moves.push(move);
        }
        return;
      }
      const destCard = column[column.length - 1];
      if (canPlaceOnTableau(cardIndex, destCard, context)) {
        const move = {
          cardIndex,
          fromType: "freeCell",
          fromIndex: cellIndex,
          toType: "tableau",
          toIndex: columnIndex,
        };
        if (!isInverseMove(move, lastMove)) {
          moves.push(move);
        }
      }
    });
  });

  state.tableau.forEach((column, columnIndex) => {
    if (column.length === 0) {
      return;
    }
    const cardIndex = column[column.length - 1];
    state.tableau.forEach((destColumn, destIndex) => {
      if (destIndex === columnIndex) {
        return;
      }
      if (destColumn.length === 0) {
        if (destIndex !== firstEmptyTableau) {
          return;
        }
        const move = {
          cardIndex,
          fromType: "tableau",
          fromIndex: columnIndex,
          toType: "tableau",
          toIndex: destIndex,
        };
        if (!isInverseMove(move, lastMove)) {
          moves.push(move);
        }
        return;
      }
      const destCard = destColumn[destColumn.length - 1];
      if (canPlaceOnTableau(cardIndex, destCard, context)) {
        const move = {
          cardIndex,
          fromType: "tableau",
          fromIndex: columnIndex,
          toType: "tableau",
          toIndex: destIndex,
        };
        if (!isInverseMove(move, lastMove)) {
          moves.push(move);
        }
      }
    });
  });

  if (emptyFreeIndex !== -1) {
    state.tableau.forEach((column, columnIndex) => {
      if (column.length === 0) {
        return;
      }
      const cardIndex = column[column.length - 1];
      const move = {
        cardIndex,
        fromType: "tableau",
        fromIndex: columnIndex,
        toType: "freeCell",
        toIndex: emptyFreeIndex,
      };
      if (!isInverseMove(move, lastMove)) {
        moves.push(move);
      }
    });
  }

  return moves;
}

function applySolverMove(state, move) {
  let tableau = state.tableau;
  let freeCells = state.freeCells;
  let foundations = state.foundations;

  if (move.fromType === "tableau" || move.toType === "tableau") {
    tableau = tableau.slice();
  }
  if (move.fromType === "freeCell" || move.toType === "freeCell") {
    freeCells = freeCells.slice();
  }
  if (move.toType === "foundation") {
    foundations = foundations.slice();
  }

  if (move.fromType === "tableau") {
    const fromColumn = tableau[move.fromIndex];
    tableau[move.fromIndex] = fromColumn.slice(0, fromColumn.length - 1);
  } else if (move.fromType === "freeCell") {
    freeCells[move.fromIndex] = -1;
  }

  if (move.toType === "tableau") {
    const destColumn = tableau[move.toIndex];
    const newColumn = destColumn.slice();
    newColumn.push(move.cardIndex);
    tableau[move.toIndex] = newColumn;
  } else if (move.toType === "freeCell") {
    freeCells[move.toIndex] = move.cardIndex;
  } else if (move.toType === "foundation") {
    foundations[move.toIndex] += 1;
  }

  return { tableau, freeCells, foundations };
}

function applyAutoFoundationMoves(state, context) {
  let currentState = state;
  const moves = [];
  let moved = true;

  while (moved) {
    moved = false;
    for (let i = 0; i < currentState.freeCells.length; i += 1) {
      const cardIndex = currentState.freeCells[i];
      if (cardIndex === -1) {
        continue;
      }
      if (isSafeFoundationMove(cardIndex, currentState.foundations, context)) {
        const move = {
          cardIndex,
          fromType: "freeCell",
          fromIndex: i,
          toType: "foundation",
          toIndex: FOUNDATION_INDEX[context.cardColor[cardIndex]],
        };
        currentState = applySolverMove(currentState, move);
        moves.push(move);
        moved = true;
        break;
      }
    }
    if (moved) {
      continue;
    }
    for (let col = 0; col < currentState.tableau.length; col += 1) {
      const column = currentState.tableau[col];
      if (column.length === 0) {
        continue;
      }
      const cardIndex = column[column.length - 1];
      if (isSafeFoundationMove(cardIndex, currentState.foundations, context)) {
        const move = {
          cardIndex,
          fromType: "tableau",
          fromIndex: col,
          toType: "foundation",
          toIndex: FOUNDATION_INDEX[context.cardColor[cardIndex]],
        };
        currentState = applySolverMove(currentState, move);
        moves.push(move);
        moved = true;
        break;
      }
    }
  }

  return { state: currentState, moves };
}

function heuristic(state, totalCards) {
  const foundationTotal = state.foundations.reduce((sum, count) => sum + count, 0);
  return totalCards - foundationTotal;
}

function isSolved(state, totalCards) {
  const foundationTotal = state.foundations.reduce((sum, count) => sum + count, 0);
  return foundationTotal === totalCards;
}

function reconstructMoves(node, context) {
  const segments = [];
  let current = node;
  while (current && current.moves) {
    segments.push(current.moves);
    current = current.parent;
  }
  segments.reverse();
  const moves = [];
  segments.forEach((segment) => {
    moves.push(...segment);
  });
  return moves.map((move) => ({
    cardId: context.cardIdByIndex[move.cardIndex],
    from: { type: move.fromType, index: move.fromIndex },
    to: { type: move.toType, index: move.toIndex },
  }));
}

function solveArcaneCells(gameState, options = {}) {
  const context = buildContext(gameState);
  const startState = buildSolverState(gameState, context);
  const startTime = Date.now();
  const maxNodes = Number.isInteger(options.maxNodes) ? options.maxNodes : 2000000;
  const maxTimeMs = Number.isInteger(options.maxTimeMs) ? options.maxTimeMs : 30000;
  const heuristicWeight = Number.isFinite(options.heuristicWeight)
    ? Math.max(1, options.heuristicWeight)
    : 2;

  const normalizedStart = applyAutoFoundationMoves(startState, context);
  const initialMoves = normalizedStart.moves;
  const normalizedState = normalizedStart.state;

  if (isSolved(normalizedState, context.totalCards)) {
    return {
      ok: true,
      moves: initialMoves.map((move) => ({
        cardId: context.cardIdByIndex[move.cardIndex],
        from: { type: move.fromType, index: move.fromIndex },
        to: { type: move.toType, index: move.toIndex },
      })),
      nodes: 0,
      elapsedMs: 0,
    };
  }

  const open = new MinHeap((a, b) => {
    if (a.f !== b.f) {
      return a.f - b.f;
    }
    return a.h - b.h;
  });
  const visited = new Map();

  const h0 = heuristic(normalizedState, context.totalCards);
  const lastInitialMove = initialMoves.length > 0 ? initialMoves[initialMoves.length - 1] : null;
  const startNode = {
    state: normalizedState,
    g: initialMoves.length,
    h: h0,
    f: initialMoves.length + h0 * heuristicWeight,
    parent: null,
    moves: null,
    lastMove: lastInitialMove,
  };
  open.push(startNode);
  visited.set(encodeState(normalizedState), initialMoves.length);

  let nodes = 0;

  while (open.size() > 0) {
    if (Date.now() - startTime > maxTimeMs) {
      return {
        ok: false,
        error: "Solver timed out before finding a solution.",
        nodes,
        elapsedMs: Date.now() - startTime,
      };
    }
    if (nodes >= maxNodes) {
      return {
        ok: false,
        error: "Solver reached the search limit before finding a solution.",
        nodes,
        elapsedMs: Date.now() - startTime,
      };
    }

    const node = open.pop();
    if (!node) {
      break;
    }
    nodes += 1;

    if (isSolved(node.state, context.totalCards)) {
      const solverMoves = reconstructMoves(node, context);
      return {
        ok: true,
        moves: initialMoves
          .map((move) => ({
            cardId: context.cardIdByIndex[move.cardIndex],
            from: { type: move.fromType, index: move.fromIndex },
            to: { type: move.toType, index: move.toIndex },
          }))
          .concat(solverMoves),
        nodes,
        elapsedMs: Date.now() - startTime,
      };
    }

    const moves = generateMoves(node.state, context, node.lastMove);
    for (const move of moves) {
      const movedState = applySolverMove(node.state, move);
      const normalized = applyAutoFoundationMoves(movedState, context);
      const edgeMoves = [move, ...normalized.moves];
      const nextState = normalized.state;
      const key = encodeState(nextState);
      const g = node.g + edgeMoves.length;
      const known = visited.get(key);
      if (known !== undefined && known <= g) {
        continue;
      }
      visited.set(key, g);
      const h = heuristic(nextState, context.totalCards);
      open.push({
        state: nextState,
        g,
        h,
        f: g + h * heuristicWeight,
        parent: node,
        moves: edgeMoves,
        lastMove: edgeMoves[edgeMoves.length - 1],
      });
    }
  }

  return {
    ok: false,
    error: "Solver could not find a solution.",
    nodes,
    elapsedMs: Date.now() - startTime,
  };
}

module.exports = {
  solveArcaneCells,
};
