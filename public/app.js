(() => {
  const role = document.body.dataset.role || "player";
  const isDM = role === "dm";

  const socket = io();
  const statusEl = document.getElementById("status");
  const messageBar = document.getElementById("message-bar");
  const freeCellsEl = document.getElementById("free-cells");
  const foundationsEl = document.getElementById("foundations");
  const tableauEl = document.getElementById("tableau");
  const trapOverlay = document.getElementById("trap-overlay");

  const dmTrapAlert = document.getElementById("trap-alert");
  const dmTrapMessage = document.getElementById("trap-message");
  const dmTrapConfirm = document.getElementById("trap-confirm");
  const startGameButton = document.getElementById("start-game");
  const trapCountInput = document.getElementById("trap-count");
  const seedInput = document.getElementById("seed-input");

  const defaultMessage = messageBar ? messageBar.innerHTML : "";

  let state = null;
  let selection = null;
  let editingIndex = null;
  let editingDraft = "";
  let initialRender = true;
  let messageTimeout = null;
  let dragState = null;

  function setStatus(text) {
    if (statusEl) {
      statusEl.textContent = text;
    }
  }

  function setMessage(text) {
    if (!messageBar) {
      return;
    }
    messageBar.textContent = text;
    messageBar.classList.add("message-alert");
    if (messageTimeout) {
      clearTimeout(messageTimeout);
    }
    messageTimeout = setTimeout(() => {
      messageBar.innerHTML = defaultMessage;
      messageBar.classList.remove("message-alert");
    }, 3000);
  }

  function clearSelectionIfMissing() {
    if (!selection || !state) {
      return;
    }
    const found = state.tableau.some((column) =>
      column.some((card) => card.id === selection.cardId)
    );
    const inFreeCell = state.freeCells.some(
      (cell) => cell.card && cell.card.id === selection.cardId
    );
    if (!found && !inFreeCell) {
      selection = null;
    }
  }

  function isFrozen() {
    return !isDM && state && state.pendingTrap && state.pendingTrap.active;
  }

  function updateFrozenState() {
    if (isFrozen()) {
      document.body.classList.add("frozen");
    } else {
      document.body.classList.remove("frozen");
    }
  }

  function updateTrapOverlay() {
    if (!trapOverlay) {
      return;
    }
    if (isFrozen()) {
      trapOverlay.classList.remove("hidden");
      trapOverlay.classList.add("active");
    } else {
      trapOverlay.classList.add("hidden");
      trapOverlay.classList.remove("active");
    }
  }

  function updateDmTrapAlert() {
    if (!isDM || !dmTrapAlert || !dmTrapMessage) {
      return;
    }
    if (state && state.pendingTrap && state.pendingTrap.active) {
      dmTrapAlert.classList.remove("hidden");
      dmTrapMessage.textContent = state.pendingTrap.message || "Trap triggered.";
    } else {
      dmTrapAlert.classList.add("hidden");
      dmTrapMessage.textContent = "";
    }
  }

  function selectCard(cardId, from) {
    if (!state || isFrozen()) {
      return;
    }
    if (selection && selection.cardId === cardId && selection.from.type === from.type && selection.from.index === from.index) {
      selection = null;
      return;
    }
    selection = { cardId, from };
    render();
  }

  function executeMove(from, cardId, to) {
    if (!from || !cardId || !state || isFrozen()) {
      return;
    }
    socket.emit("move", {
      from,
      to,
      cardId,
    });
    selection = null;
    dragState = null;
  }

  function attemptMove(to) {
    if (!selection) {
      return;
    }
    executeMove(selection.from, selection.cardId, to);
  }

  function attemptDragMove(to) {
    if (!dragState) {
      return;
    }
    executeMove(dragState.from, dragState.cardId, to);
  }

  function createCardElement(card, location) {
    const cardEl = document.createElement("div");
    cardEl.className = `card card-${card.color}`;
    if (card.isTrap) {
      cardEl.classList.add("trap-visible");
    }

    if (selection) {
      if (selection.cardId === card.id) {
        cardEl.classList.add("selected");
      }
    }

    if (initialRender) {
      cardEl.classList.add("deal");
      cardEl.style.setProperty("--delay", `${location.delay}ms`);
    }

    const manaEl = document.createElement("div");
    manaEl.className = `mana-symbol mana-${card.color}`;

    const valueEl = document.createElement("div");
    valueEl.className = "card-value";
    valueEl.textContent = String(card.value);

    const hintEl = document.createElement("div");
    hintEl.className = "card-hint";
    hintEl.textContent = String(location.type === "foundation" ? 0 : card.hint);

    const trapEl = document.createElement("div");
    trapEl.className = "card-trap";
    trapEl.textContent = card.trapId ? `#${card.trapId}` : "";

    cardEl.appendChild(manaEl);
    cardEl.appendChild(valueEl);
    cardEl.appendChild(hintEl);
    cardEl.appendChild(trapEl);

    cardEl.addEventListener("click", (event) => {
      event.stopPropagation();
      if (location.type === "tableau" && !location.isTop) {
        return;
      }
      if (
        selection &&
        selection.cardId === card.id &&
        selection.from.type === location.type &&
        selection.from.index === location.index
      ) {
        selection = null;
        render();
        return;
      }
      if (selection) {
        attemptMove({ type: location.type, index: location.index });
        return;
      }
      if (location.type === "foundation") {
        return;
      }
      selectCard(card.id, location);
    });

    cardEl.addEventListener("dragover", (event) => {
      if (!dragState || isFrozen()) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });

    cardEl.addEventListener("drop", (event) => {
      if (!dragState || isFrozen()) {
        return;
      }
      event.preventDefault();
      attemptDragMove({ type: location.type, index: location.index });
    });

    if (location.type !== "foundation" && (location.type !== "tableau" || location.isTop)) {
      cardEl.setAttribute("draggable", "true");
      cardEl.addEventListener("dragstart", (event) => {
        if (isFrozen()) {
          event.preventDefault();
          return;
        }
        dragState = { cardId: card.id, from: { type: location.type, index: location.index } };
        event.dataTransfer.setData("text/plain", card.id);
        event.dataTransfer.effectAllowed = "move";
        selection = dragState;
      });
      cardEl.addEventListener("dragend", () => {
        dragState = null;
        selection = null;
        render();
      });
    }

    return cardEl;
  }

  function renderFreeCells() {
    if (!freeCellsEl) {
      return;
    }
    freeCellsEl.innerHTML = "";

    let focusInput = null;

    if (editingIndex !== null) {
      const editingCell = state.freeCells[editingIndex];
      if (!editingCell || !editingCell.lockOwner) {
        editingIndex = null;
        editingDraft = "";
      }
    }

    state.freeCells.forEach((cell, index) => {
      const cellEl = document.createElement("div");
      cellEl.className = "free-cell";
      if (cell.locked) {
        cellEl.classList.add("locked");
      }

      const slot = document.createElement("div");
      slot.className = "cell-slot free-cell-slot";
      slot.addEventListener("click", (event) => {
        event.stopPropagation();
        if (selection) {
          attemptMove({ type: "freeCell", index });
        }
      });
      slot.addEventListener("dragover", (event) => {
        if (!dragState || isFrozen()) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      });
      slot.addEventListener("drop", (event) => {
        if (!dragState || isFrozen()) {
          return;
        }
        event.preventDefault();
        attemptDragMove({ type: "freeCell", index });
      });

      if (cell.card) {
        const cardEl = createCardElement(cell.card, {
          type: "freeCell",
          index,
          delay: 0,
        });
        slot.appendChild(cardEl);
      } else {
        const empty = document.createElement("div");
        empty.className = "slot-empty";
        empty.textContent = "Empty";
        slot.appendChild(empty);
      }

      const nameWrap = document.createElement("div");
      nameWrap.className = "free-cell-name";
      nameWrap.textContent = cell.name
        ? cell.name
        : cell.locked
          ? "Editing..."
          : "Click to name";

      nameWrap.addEventListener("click", (event) => {
        event.stopPropagation();
        if (isFrozen()) {
          return;
        }
        editingIndex = index;
        editingDraft = cell.name;
        socket.emit("freeCellLock", { index });
      });

      cellEl.appendChild(slot);
      cellEl.appendChild(nameWrap);

      if (editingIndex === index && cell.lockOwner) {
        const input = document.createElement("input");
        input.className = "free-cell-input";
        input.value = editingDraft;

        input.addEventListener("input", (event) => {
          editingDraft = event.target.value;
        });

        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitEdit(index, input.value);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancelEdit(index);
          }
        });

        input.addEventListener("blur", () => {
          commitEdit(index, input.value);
        });

        cellEl.appendChild(input);
        focusInput = input;
      }

      freeCellsEl.appendChild(cellEl);
    });

    if (focusInput) {
      setTimeout(() => focusInput.focus(), 0);
    }
  }

  function renderFoundations() {
    if (!foundationsEl) {
      return;
    }
    foundationsEl.innerHTML = "";

    state.foundations.forEach((pile, index) => {
      const pileEl = document.createElement("div");
      pileEl.className = `foundation foundation-${pile.color}`;
      pileEl.addEventListener("click", (event) => {
        event.stopPropagation();
        if (selection) {
          attemptMove({ type: "foundation", index });
        }
      });
      pileEl.addEventListener("dragover", (event) => {
        if (!dragState || isFrozen()) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      });
      pileEl.addEventListener("drop", (event) => {
        if (!dragState || isFrozen()) {
          return;
        }
        event.preventDefault();
        attemptDragMove({ type: "foundation", index });
      });

      const manaEl = document.createElement("div");
      manaEl.className = `mana-symbol mana-${pile.color}`;
      pileEl.appendChild(manaEl);

      if (pile.topCard) {
        const cardEl = createCardElement(pile.topCard, {
          type: "foundation",
          index,
          delay: 0,
        });
        pileEl.appendChild(cardEl);
      }

      foundationsEl.appendChild(pileEl);
    });
  }

  function renderTableau() {
    if (!tableauEl) {
      return;
    }
    tableauEl.innerHTML = "";

    state.tableau.forEach((column, index) => {
      const columnEl = document.createElement("div");
      columnEl.className = "tableau-column";
      columnEl.addEventListener("click", (event) => {
        event.stopPropagation();
        if (selection) {
          attemptMove({ type: "tableau", index });
        }
      });
      columnEl.addEventListener("dragover", (event) => {
        if (!dragState || isFrozen()) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      });
      columnEl.addEventListener("drop", (event) => {
        if (!dragState || isFrozen()) {
          return;
        }
        event.preventDefault();
        attemptDragMove({ type: "tableau", index });
      });

      if (column.length === 0) {
        const placeholder = document.createElement("div");
        placeholder.className = "column-empty";
        placeholder.textContent = "Empty";
        columnEl.appendChild(placeholder);
      }

      column.forEach((card, cardIndex) => {
        const cardEl = createCardElement(card, {
          type: "tableau",
          index,
          isTop: cardIndex === column.length - 1,
          delay: (index + 1) * 40 + cardIndex * 10,
        });
        columnEl.appendChild(cardEl);
      });

      tableauEl.appendChild(columnEl);
    });
  }

  function render() {
    if (!state) {
      return;
    }
    clearSelectionIfMissing();
    renderFreeCells();
    renderFoundations();
    renderTableau();
    updateFrozenState();
    updateTrapOverlay();
    updateDmTrapAlert();

    if (initialRender) {
      document.body.classList.add("loaded");
      initialRender = false;
    }
  }

  function commitEdit(index, value) {
    socket.emit("freeCellName", { index, name: value });
    socket.emit("freeCellUnlock", { index });
    editingIndex = null;
    editingDraft = "";
  }

  function cancelEdit(index) {
    socket.emit("freeCellUnlock", { index });
    editingIndex = null;
    editingDraft = "";
  }

  socket.on("connect", () => {
    setStatus("Connected");
    socket.emit("register", { role });
  });

  socket.on("disconnect", () => {
    setStatus("Disconnected");
  });

  socket.on("state", (newState) => {
    state = newState;
    render();
  });

  socket.on("actionError", (payload) => {
    if (payload && payload.message) {
      setMessage(payload.message);
    }
  });

  socket.on("trapTriggered", (payload) => {
    if (isDM && payload && payload.message) {
      setMessage(payload.message);
    }
  });

  document.body.addEventListener("click", () => {
    if (selection) {
      selection = null;
      render();
    }
  });

  if (isDM && dmTrapConfirm) {
    dmTrapConfirm.addEventListener("click", () => {
      socket.emit("resolveTrap");
    });
  }

  if (isDM && startGameButton) {
    startGameButton.addEventListener("click", () => {
      const trapCount = trapCountInput ? trapCountInput.value : 10;
      const seed = seedInput ? seedInput.value : 42;
      socket.emit("startGame", {
        trapCount,
        seed: Number.parseInt(seed, 10),
      });
    });
  }

  const resetGameButton = document.getElementById("reset-game");
  if (resetGameButton) {
    resetGameButton.addEventListener("click", () => {
      if (!window.confirm("Reset the board?")) {
        return;
      }
      if (!isDM) {
        setMessage("Only the DM can reset the board.");
        return;
      }
      socket.emit("resetGame");
    });
  }
})();
