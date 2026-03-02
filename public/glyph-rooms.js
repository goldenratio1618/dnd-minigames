(() => {
  const role = document.body.dataset.role || "player";
  const isDM = role === "dm";
  const socket = io("/glyph-rooms");

  const statusEl = document.getElementById("status");
  const messageBar = document.getElementById("message-bar");
  const startGameButton = document.getElementById("start-game");
  const hpTextEl = document.getElementById("hp-text");
  const hpMeterFillEl = document.getElementById("hp-meter-fill");
  const equippedGreenEl = document.getElementById("equipped-green");
  const roomEl = document.getElementById("room-glyphs");
  const blueGlyphButton = document.getElementById("blue-glyph");
  const solveGameButton = document.getElementById("solve-game");
  const gameSelectEl = document.getElementById("game-select");

  const defaultMessage = messageBar ? messageBar.innerHTML : "";
  let state = null;
  let messageTimeout = null;
  let solving = false;
  let announcedVictory = false;
  let announcedDefeat = false;

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
    }, 2200);
  }

  function updateGameSelector() {
    if (!isDM || !gameSelectEl) {
      return;
    }
    const routeByGame = {
      "arcane-cells": "/dm.html",
      "echoing-mines": "/dm-echoing-mines.html",
      "glyph-rooms": "/dm-glyph-rooms.html",
    };
    const gameByRoute = {
      "/dm.html": "arcane-cells",
      "/dm-echoing-mines.html": "echoing-mines",
      "/dm-glyph-rooms.html": "glyph-rooms",
    };
    gameSelectEl.value = gameByRoute[window.location.pathname] || "glyph-rooms";
    gameSelectEl.addEventListener("change", () => {
      const route = routeByGame[gameSelectEl.value];
      if (route) {
        window.location.assign(route);
      }
    });
  }

  function getGlyphManaClass(glyph) {
    if (!glyph) {
      return "mana-white";
    }
    if (glyph.type === "white") {
      return "mana-white";
    }
    if (glyph.type === "black") {
      return "mana-black";
    }
    if (glyph.type === "green") {
      return "mana-green";
    }
    return "mana-white";
  }

  function createGlyphElement(glyph) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `glyph-card glyph-${glyph.type}`;

    const mana = document.createElement("span");
    mana.className = `mana-symbol ${getGlyphManaClass(glyph)}`;
    button.appendChild(mana);

    const value = document.createElement("span");
    value.className = "glyph-value";
    value.textContent = String(glyph.value);
    button.appendChild(value);

    if (glyph.type === "green") {
      const guard = document.createElement("span");
      guard.className = "glyph-guard";
      guard.textContent = String(glyph.guard);
      button.appendChild(guard);
    }

    button.addEventListener("click", () => {
      if (!state || !state.started || state.finished) {
        return;
      }
      let useBlock = false;
      if (
        glyph.type === "black" &&
        state.equippedGreen &&
        state.equippedGreen.guard > glyph.value
      ) {
        useBlock = window.confirm("Use equipped green glyph to block?");
      }
      socket.emit("clickGlyph", {
        glyphId: glyph.id,
        useBlock,
      });
    });

    return button;
  }

  function renderEquippedGlyph() {
    if (!equippedGreenEl) {
      return;
    }
    equippedGreenEl.innerHTML = "";
    if (!state || !state.equippedGreen) {
      equippedGreenEl.classList.add("empty");
      equippedGreenEl.textContent = "-";
      return;
    }
    equippedGreenEl.classList.remove("empty");
    const mana = document.createElement("span");
    mana.className = "mana-symbol mana-green";
    const value = document.createElement("span");
    value.className = "equipped-glyph-value";
    value.textContent = String(state.equippedGreen.value);
    const divider = document.createElement("span");
    divider.className = "equipped-glyph-divider";
    divider.textContent = "/";
    const guard = document.createElement("span");
    guard.className = "equipped-glyph-guard";
    guard.textContent = String(state.equippedGreen.guard);

    equippedGreenEl.appendChild(mana);
    equippedGreenEl.appendChild(value);
    equippedGreenEl.appendChild(divider);
    equippedGreenEl.appendChild(guard);
  }

  function renderRoom() {
    if (!roomEl) {
      return;
    }
    roomEl.innerHTML = "";
    if (!state || !state.started) {
      return;
    }
    state.room.forEach((glyph) => {
      roomEl.appendChild(createGlyphElement(glyph));
    });
  }

  function renderHp() {
    if (!hpTextEl || !hpMeterFillEl) {
      return;
    }
    if (!state || !state.started || !Number.isInteger(state.hp) || !Number.isInteger(state.maxHp)) {
      hpTextEl.textContent = "-";
      hpMeterFillEl.style.width = "0%";
      return;
    }
    hpTextEl.textContent = `${state.hp} / ${state.maxHp}`;
    const ratio = state.maxHp > 0 ? Math.max(0, Math.min(1, state.hp / state.maxHp)) : 0;
    hpMeterFillEl.style.width = `${ratio * 100}%`;
  }

  function renderBlueGlyph() {
    if (!blueGlyphButton) {
      return;
    }
    const active = Boolean(
      state &&
        state.started &&
        state.blueActive &&
        !state.finished &&
        Array.isArray(state.room) &&
        state.room.length === 4
    );
    blueGlyphButton.disabled = !active;
    blueGlyphButton.classList.toggle("inactive", !active);
  }

  function render() {
    renderHp();
    renderEquippedGlyph();
    renderRoom();
    renderBlueGlyph();
  }

  function updateSolveButton() {
    if (!isDM || !solveGameButton) {
      return;
    }
    solveGameButton.disabled = solving;
    solveGameButton.textContent = solving ? "Solving..." : "Solve run";
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
    const hasClearedAllGlyphs = Boolean(
      state &&
        state.started &&
        state.deckCount === 0 &&
        Array.isArray(state.room) &&
        state.room.length === 0
    );
    const hasDefeat = Boolean(
      state &&
        state.started &&
        state.finished &&
        Number.isInteger(state.hp) &&
        state.hp <= 0
    );
    if (hasClearedAllGlyphs) {
      if (!announcedVictory) {
        setMessage("Victory! All glyphs are cleared.");
      }
      announcedVictory = true;
    } else {
      announcedVictory = false;
    }
    if (hasDefeat) {
      if (!announcedDefeat) {
        setMessage("Run ended.");
      }
      announcedDefeat = true;
    } else {
      announcedDefeat = false;
    }
    render();
  });

  socket.on("actionError", (payload) => {
    if (payload && payload.message) {
      setMessage(payload.message);
    }
  });

  socket.on("solverResult", (payload) => {
    if (!isDM) {
      return;
    }
    solving = false;
    updateSolveButton();
    const moves = payload && Number.isInteger(payload.moves) ? payload.moves : null;
    if (moves !== null) {
      setMessage(`Solved in ${moves} clicks.`);
      return;
    }
    setMessage("Solver found a full clear.");
  });

  socket.on("solverError", (payload) => {
    if (!isDM) {
      return;
    }
    solving = false;
    updateSolveButton();
    const message = payload && payload.message ? payload.message : "Solver failed.";
    setMessage(message);
  });

  if (startGameButton) {
    startGameButton.addEventListener("click", () => {
      const response = window.prompt(
        "Enter your current HP (do not include temporary HP)."
      );
      if (response === null) {
        return;
      }
      const hp = Number.parseInt(response, 10);
      if (!Number.isFinite(hp) || Number.isNaN(hp) || hp <= 0) {
        setMessage("Enter a valid HP value.");
        return;
      }
      socket.emit("startGame", { maxHp: hp });
    });
  }

  if (blueGlyphButton) {
    blueGlyphButton.addEventListener("click", () => {
      socket.emit("useBlueGlyph");
    });
  }

  if (isDM && solveGameButton) {
    solveGameButton.addEventListener("click", () => {
      if (solving) {
        return;
      }
      solving = true;
      updateSolveButton();
      socket.emit("solveGame");
    });
  }

  updateGameSelector();
  updateSolveButton();
})();
