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

  const defaultMessage = messageBar ? messageBar.textContent : "";

  let state = null;
  let selection = null;
  let editingIndex = null;
  let editingDraft = "";
  let initialRender = true;
  let messageTimeout = null;

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
      messageBar.textContent = defaultMessage;
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

  function attemptMove(to) {
    if (!selection || !state || isFrozen()) {
      return;
    }
    socket.emit("move", {
      from: selection.from,
      to,
      cardId: selection.cardId,
    });
    selection = null;
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
      } else if (selection.from.type === "tableau" && selection.from.index === location.index) {
        const column = state.tableau[location.index];
        const stackIndex = column.findIndex((entry) => entry.id === selection.cardId);
        if (stackIndex !== -1) {
          const stackIds = column.slice(stackIndex).map((entry) => entry.id);
          if (stackIds.includes(card.id)) {
            cardEl.classList.add("selected-stack");
          }
        }
      }
    }

    if (initialRender) {
      cardEl.classList.add("deal");
      cardEl.style.setProperty("--delay", `${location.delay}ms`);
    }

    const valueEl = document.createElement("div");
    valueEl.className = "card-value";
    valueEl.textContent = String(card.value);

    const hintEl = document.createElement("div");
    hintEl.className = "card-hint";
    hintEl.textContent = String(card.hint);

    const trapEl = document.createElement("div");
    trapEl.className = "card-trap";
    trapEl.textContent = card.trapId ? `#${card.trapId}` : "";

    cardEl.appendChild(valueEl);
    cardEl.appendChild(hintEl);
    cardEl.appendChild(trapEl);

    cardEl.addEventListener("click", (event) => {
      event.stopPropagation();
      if (selection) {
        attemptMove({ type: location.type, index: location.index });
        return;
      }
      if (location.type === "foundation") {
        return;
      }
      selectCard(card.id, location);
    });

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

      if (pile.topCard) {
        const cardEl = createCardElement(pile.topCard, {
          type: "foundation",
          index,
          delay: 0,
        });
        pileEl.appendChild(cardEl);
      } else {
        const label = document.createElement("div");
        label.className = "foundation-label";
        label.textContent = pile.color;
        pileEl.appendChild(label);
      }

      const count = document.createElement("div");
      count.className = "foundation-count";
      count.textContent = `${pile.count}`;
      pileEl.appendChild(count);

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
      socket.emit("startGame", { trapCount });
    });
  }
})();
