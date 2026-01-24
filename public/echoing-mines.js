(() => {
  const role = document.body.dataset.role || "player";
  const isDM = role === "dm";

  const socket = io("/echoing-mines");
  const statusEl = document.getElementById("status");
  const messageBar = document.getElementById("message-bar");
  const rosterEl = document.getElementById("token-roster");
  const gridEl = document.getElementById("mine-grid");
  const levelDisplay = document.getElementById("level-display");
  const trapOverlay = document.getElementById("trap-overlay");

  const dmTrapAlert = document.getElementById("trap-alert");
  const dmTrapMessage = document.getElementById("trap-message");
  const dmTrapConfirm = document.getElementById("trap-confirm");
  const startGameButton = document.getElementById("start-game");
  const levelInput = document.getElementById("level-input");
  const seedInput = document.getElementById("seed-input");

  const defaultMessage = messageBar ? messageBar.innerHTML : "";

  let state = null;
  let initialRender = true;
  let messageTimeout = null;
  let editingTokenId = null;
  let editingDraft = "";
  let dragTokenId = null;
  let dragFrom = null;

  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxSize = 80;
          const scale = Math.min(
            maxSize / img.width,
            maxSize / img.height,
            1
          );
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Missing canvas context."));
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => reject(new Error("Bad image."));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error("Bad read."));
      reader.readAsDataURL(file);
    });
  }

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

  function formatBlockDirections(directions) {
    const set = new Set(directions || []);
    if (set.size === 0) {
      return "?";
    }
    if (set.size === 4) {
      return "+";
    }
    if (set.size === 2 && set.has("left") && set.has("right")) {
      return "<>";
    }
    if (set.size === 2 && set.has("up") && set.has("down")) {
      return "^v";
    }
    const map = {
      left: "<",
      right: ">",
      up: "^",
      down: "v",
    };
    return Array.from(set)
      .map((dir) => map[dir] || "?")
      .join("");
  }

  function canEditToken(token) {
    if (isDM) {
      return true;
    }
    return !token.owned || token.ownedBySelf;
  }

  function startEditing(token) {
    if (!canEditToken(token)) {
      return;
    }
    editingTokenId = token.id;
    editingDraft = token.name || "";
    renderRoster();
  }

  function commitTokenName(token) {
    socket.emit("setTokenName", { tokenId: token.id, name: editingDraft });
    editingTokenId = null;
    editingDraft = "";
  }

  function cancelTokenEdit() {
    editingTokenId = null;
    editingDraft = "";
    renderRoster();
  }

  function renderRoster() {
    if (!rosterEl || !state) {
      return;
    }
    rosterEl.innerHTML = "";
    state.tokens.forEach((token) => {
      const card = document.createElement("div");
      card.className = "token-card";

      const avatarWrap = document.createElement("div");
      avatarWrap.className = "token-avatar";
      if (token.avatar) {
        avatarWrap.classList.add("has-avatar");
        avatarWrap.style.backgroundImage = `url("${token.avatar}")`;
      } else {
        avatarWrap.textContent = token.name
          ? token.name.slice(0, 1).toUpperCase()
          : "?";
      }

      const canEdit = canEditToken(token);
      if (canEdit) {
        const avatarInput = document.createElement("input");
        avatarInput.type = "file";
        avatarInput.accept = "image/*";
        avatarInput.className = "token-avatar-input";
        avatarInput.addEventListener("change", () => {
          const file = avatarInput.files && avatarInput.files[0];
          if (!file) {
            return;
          }
          readImageFile(file)
            .then((dataUrl) => {
              socket.emit("setTokenAvatar", {
                tokenId: token.id,
                avatar: dataUrl,
              });
            })
            .catch(() => {
              setMessage("That image could not be loaded.");
            });
        });

        const uploadButton = document.createElement("button");
        uploadButton.type = "button";
        uploadButton.className = "token-avatar-button";
        uploadButton.textContent = token.avatar ? "Change token" : "Upload token";
        uploadButton.addEventListener("click", () => {
          avatarInput.click();
        });

        const clearButton = document.createElement("button");
        clearButton.type = "button";
        clearButton.className = "token-avatar-clear";
        clearButton.textContent = "Clear";
        clearButton.addEventListener("click", () => {
          socket.emit("setTokenAvatar", { tokenId: token.id, avatar: "" });
        });

        card.appendChild(avatarWrap);
        card.appendChild(avatarInput);
        card.appendChild(uploadButton);
        if (token.avatar) {
          card.appendChild(clearButton);
        }
      } else {
        card.appendChild(avatarWrap);
      }

      const nameEl = document.createElement("div");
      nameEl.className = "token-name";
      if (editingTokenId === token.id) {
        const input = document.createElement("input");
        input.className = "token-input";
        input.type = "text";
        input.value = editingDraft;
        input.maxLength = 24;
        input.addEventListener("input", (event) => {
          editingDraft = event.target.value;
        });
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitTokenName(token);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancelTokenEdit();
          }
        });
        input.addEventListener("blur", () => {
          commitTokenName(token);
        });
        nameEl.appendChild(input);
        setTimeout(() => input.focus(), 0);
      } else {
        const label = token.name ? token.name : "Unclaimed";
        nameEl.textContent = label;
        if (canEditToken(token)) {
          nameEl.classList.add("token-name-editable");
          nameEl.addEventListener("click", () => startEditing(token));
        }
      }

      const goldEl = document.createElement("div");
      goldEl.className = "token-gold";
      goldEl.textContent = `Gold: ${token.gold}`;

      card.appendChild(nameEl);
      card.appendChild(goldEl);
      rosterEl.appendChild(card);
    });
  }

  function isAdjacent(from, to) {
    if (!from) {
      return false;
    }
    const dx = Math.abs(from.x - to.x);
    const dy = Math.abs(from.y - to.y);
    return dx + dy === 1;
  }

  function renderGrid() {
    if (!gridEl || !state) {
      return;
    }
    gridEl.innerHTML = "";
    gridEl.style.gridTemplateColumns = `repeat(${state.width}, var(--cell-size))`;

    const tokenMap = new Map();
    state.tokens.forEach((token) => {
      const key = `${token.x},${token.y}`;
      const list = tokenMap.get(key) || [];
      list.push(token);
      tokenMap.set(key, list);
    });

    const monsterMap = new Map();
    state.monsters.forEach((monster) => {
      const key = `${monster.x},${monster.y}`;
      monsterMap.set(key, monster);
    });

    const startArea = state.startArea;
    state.tiles.forEach((row, y) => {
      row.forEach((tile, x) => {
        const cell = document.createElement("div");
        cell.className = "mine-cell";
        cell.dataset.x = x;
        cell.dataset.y = y;

        if (!tile.visible) {
          cell.classList.add("cell-hidden");
        } else if (tile.uncovered) {
          cell.classList.add("cell-uncovered");
        } else {
          cell.classList.add("cell-adjacent");
        }

        if (tile.visible) {
          cell.classList.add(`cell-${tile.type}`);
          let content = "";
          if (tile.type === "block") {
            content = formatBlockDirections(tile.directions);
          } else if (tile.type === "trap") {
            content = "X";
          } else if (tile.type === "treasure") {
            content = "$";
          } else if (tile.type === "exit") {
            content = "EXIT";
          } else if (tile.type === "unknown") {
            content = "?";
          } else if (
            tile.type === "empty" &&
            (tile.uncovered || isDM) &&
            tile.number > 0
          ) {
            content = String(tile.number);
          }
          if (content) {
            const text = document.createElement("span");
            text.className = "cell-content";
            text.textContent = content;
            cell.appendChild(text);
          }
        }

        const tokenKey = `${x},${y}`;
        if (tokenMap.has(tokenKey)) {
          const tokenWrap = document.createElement("div");
          tokenWrap.className = "cell-tokens";
          tokenMap.get(tokenKey).forEach((token) => {
            const tokenEl = document.createElement("div");
            tokenEl.className = "token-marker";
            if (token.avatar) {
              tokenEl.classList.add("token-has-avatar");
              tokenEl.style.backgroundImage = `url("${token.avatar}")`;
            } else {
              tokenEl.textContent = token.name
                ? token.name.slice(0, 1).toUpperCase()
                : "?";
            }
            const draggable =
              !isFrozen() && (isDM || token.ownedBySelf || !token.owned);
            tokenEl.draggable = draggable;
            if (draggable) {
              tokenEl.addEventListener("dragstart", (event) => {
                dragTokenId = token.id;
                dragFrom = { x: token.x, y: token.y };
                event.dataTransfer.setData("text/plain", token.id);
                event.dataTransfer.effectAllowed = "move";
              });
              tokenEl.addEventListener("dragend", () => {
                dragTokenId = null;
                dragFrom = null;
              });
            } else {
              tokenEl.classList.add("token-locked");
            }
            tokenWrap.appendChild(tokenEl);
          });
          cell.appendChild(tokenWrap);
        }

        const monster = monsterMap.get(tokenKey);
        if (monster) {
          const monsterEl = document.createElement("div");
          monsterEl.className = `monster-marker monster-${monster.type}`;
          monsterEl.textContent = monster.type.slice(0, 1).toUpperCase();
          cell.appendChild(monsterEl);
        }

        if (
          startArea &&
          x >= startArea.x &&
          x < startArea.x + startArea.size &&
          y >= startArea.y &&
          y < startArea.y + startArea.size
        ) {
          cell.classList.add("cell-start");
          if (x === startArea.x + 1 && y === startArea.y + 1) {
            const startLabel = document.createElement("span");
            startLabel.className = "cell-start-label";
            startLabel.textContent = "START";
            cell.appendChild(startLabel);
          }
        }

        cell.addEventListener("dragover", (event) => {
          if (!dragTokenId || isFrozen()) {
            return;
          }
          if (dragFrom && !isAdjacent(dragFrom, { x, y })) {
            return;
          }
          event.preventDefault();
          cell.classList.add("cell-drop");
        });
        cell.addEventListener("dragleave", () => {
          cell.classList.remove("cell-drop");
        });
        cell.addEventListener("drop", (event) => {
          event.preventDefault();
          cell.classList.remove("cell-drop");
          if (!dragTokenId || isFrozen()) {
            return;
          }
          if (dragFrom && !isAdjacent(dragFrom, { x, y })) {
            setMessage("Move one tile at a time.");
            return;
          }
          socket.emit("moveToken", { tokenId: dragTokenId, to: { x, y } });
          dragTokenId = null;
          dragFrom = null;
        });

        gridEl.appendChild(cell);
      });
    });
  }

  function render() {
    if (!state) {
      return;
    }
    renderRoster();
    renderGrid();
    updateFrozenState();
    updateTrapOverlay();
    updateDmTrapAlert();
    if (levelDisplay) {
      levelDisplay.textContent = `Level ${state.level}`;
    }
    if (initialRender) {
      document.body.classList.add("loaded");
      initialRender = false;
    }
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

  socket.on("announcement", (payload) => {
    if (payload && payload.message) {
      setMessage(payload.message);
    }
  });

  socket.on("trapTriggered", (payload) => {
    if (isDM && payload && payload.message) {
      setMessage(payload.message);
    }
  });

  if (isDM && dmTrapConfirm) {
    dmTrapConfirm.addEventListener("click", () => {
      socket.emit("resolveTrap");
    });
  }

  if (isDM && startGameButton) {
    startGameButton.addEventListener("click", () => {
      const level = levelInput ? levelInput.value : 1;
      const seed = seedInput ? seedInput.value : 42;
      socket.emit("startGame", {
        level: Number.parseInt(level, 10),
        seed: Number.parseInt(seed, 10),
      });
    });
  }

  const resetGameButton = document.getElementById("reset-game");
  if (resetGameButton) {
    resetGameButton.addEventListener("click", () => {
      if (!window.confirm("Reset the level?")) {
        return;
      }
      if (!isDM) {
        setMessage("Only the DM can reset the level.");
        return;
      }
      socket.emit("resetGame");
    });
  }
})();
