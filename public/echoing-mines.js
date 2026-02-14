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
  const combatPanel = document.getElementById("combat-panel");
  const combatTracker = document.getElementById("combat-tracker");
  const combatResort = document.getElementById("combat-resort");
  const combatPrev = document.getElementById("combat-prev");
  const combatNext = document.getElementById("combat-next");
  const combatExit = document.getElementById("combat-exit");
  const monsterDelete = document.getElementById("monster-delete");
  const monsterConfigEl = document.getElementById("monster-config");
  const monsterConfigRow = document.getElementById("monster-config-row");
  const undoActionButton = document.getElementById("undo-action");
  const redoActionButton = document.getElementById("redo-action");
  const headerVerseEl = document.getElementById("header-verse");

  const dmTrapAlert = document.getElementById("trap-alert");
  const dmTrapMessage = document.getElementById("trap-message");
  const dmTrapConfirm = document.getElementById("trap-confirm");
  const startGameButton = document.getElementById("start-game");
  const levelInput = document.getElementById("level-input");
  const seedInput = document.getElementById("seed-input");
  const solveLevelButton = document.getElementById("solve-level");
  const generationAttemptsEl = document.getElementById("generation-attempts");
  const saveMapButton = document.getElementById("save-map");
  const exportMapButton = document.getElementById("export-map");
  const loadMapButton = document.getElementById("load-map-button");
  const loadMapSelect = document.getElementById("load-map-select");
  const loadMapDiskButton = document.getElementById("load-map-disk-button");
  const loadMapDiskInput = document.getElementById("load-map-disk-input");
  const fogToggleInput = document.getElementById("fog-toggle-input");
  const mapEditorToolsEl = document.getElementById("map-editor-tools");

  const defaultMessage = messageBar ? messageBar.innerHTML : "";
  const SAVE_KEY = "echoingMinesSavedMaps";

  let liveState = null;
  let state = null;
  let initialRender = true;
  let messageTimeout = null;
  let editingTokenId = null;
  let editingDraft = "";
  let dragTokenId = null;
  let dragFrom = null;
  let selectedTokenId = null;
  let selectedMonsterId = null;
  let dragMonsterId = null;
  let dragMonsterFrom = null;
  let selectedMapBrush = null;
  let savedMaps = [];
  const mapBrushDrag = {
    active: false,
    brushId: null,
    paintedKeys: new Set(),
  };
  const solverPlayback = {
    active: false,
    timer: null,
    index: 0,
    moves: [],
    state: null,
  };

  const DIRECTION_ORDER = ["up", "right", "down", "left"];
  const MANA_BUTTON_TILE_TYPES = new Set([
    "mana-button-white",
    "mana-button-blue",
    "mana-button-black",
    "mana-button-green",
  ]);
  const MANA_BUTTON_COLORS = {
    "mana-button-white": "white",
    "mana-button-blue": "blue",
    "mana-button-black": "black",
    "mana-button-green": "green",
  };
  const DEFAULT_INSCRIPTION_HTML = headerVerseEl ? headerVerseEl.innerHTML : "";
  const MAP_BRUSHES = [
    { id: "erase", label: "Clear", payload: { mode: "tile", tileType: "empty" } },
    { id: "rock", label: "Rock", payload: { mode: "tile", tileType: "rock" } },
    { id: "trap", label: "Trap", payload: { mode: "tile", tileType: "trap" } },
    { id: "treasure", label: "Treasure", payload: { mode: "tile", tileType: "treasure" } },
    { id: "magic-item", label: "Item Star", payload: { mode: "tile", tileType: "magic-item" } },
    { id: "exit", label: "Exit", payload: { mode: "tile", tileType: "exit" } },
    {
      id: "mana-white",
      label: "Mana W",
      payload: { mode: "tile", tileType: "mana-button-white" },
    },
    {
      id: "mana-blue",
      label: "Mana U",
      payload: { mode: "tile", tileType: "mana-button-blue" },
    },
    {
      id: "mana-black",
      label: "Mana B",
      payload: { mode: "tile", tileType: "mana-button-black" },
    },
    {
      id: "mana-green",
      label: "Mana G",
      payload: { mode: "tile", tileType: "mana-button-green" },
    },
    {
      id: "block-right",
      label: "Block >",
      payload: { mode: "tile", tileType: "block", directions: ["right"] },
    },
    {
      id: "block-left",
      label: "Block <",
      payload: { mode: "tile", tileType: "block", directions: ["left"] },
    },
    {
      id: "block-up",
      label: "Block ^",
      payload: { mode: "tile", tileType: "block", directions: ["up"] },
    },
    {
      id: "block-down",
      label: "Block v",
      payload: { mode: "tile", tileType: "block", directions: ["down"] },
    },
    {
      id: "block-h",
      label: "Block <>",
      payload: { mode: "tile", tileType: "block", directions: ["left", "right"] },
    },
    {
      id: "block-v",
      label: "Block ^v",
      payload: { mode: "tile", tileType: "block", directions: ["up", "down"] },
    },
    {
      id: "block-all",
      label: "Block +",
      payload: {
        mode: "tile",
        tileType: "block",
        directions: ["up", "right", "down", "left"],
      },
    },
    { id: "monster-green", label: "Monster G", payload: { mode: "monster", monsterType: "green" } },
    { id: "monster-yellow", label: "Monster Y", payload: { mode: "monster", monsterType: "yellow" } },
    { id: "monster-red", label: "Monster R", payload: { mode: "monster", monsterType: "red" } },
    { id: "monster-violet", label: "Monster V", payload: { mode: "monster", monsterType: "violet" } },
    { id: "monster-erase", label: "Remove monster", payload: { mode: "erase-monster" } },
  ];
  const SOUND_FILES = {
    "block-drag": "/sounds/stoneblockdragwoodgrind-82327.mp3",
    "gold-break": "/sounds/breaking-glass-83809.mp3",
    coinbag: "/sounds/freesound_community-coinbag-91016.mp3",
    flourish: "/sounds/freesound_community-flourish-spacey-1-86845.mp3",
    "monster-howl": "/sounds/monster-howl-85304.mp3",
    "monster-roar": "/sounds/monster-warrior-roar-195877.mp3",
    "trap-explosion": "/sounds/explosion-sound-effect-425455.mp3",
  };
  const soundCache = new Map();
  const MOVE_DIRECTIONS = [
    { name: "up", dx: 0, dy: -1 },
    { name: "down", dx: 0, dy: 1 },
    { name: "left", dx: -1, dy: 0 },
    { name: "right", dx: 1, dy: 0 },
  ];

  function normalizeDirections(directions) {
    const set = new Set(directions || []);
    return DIRECTION_ORDER.filter((dir) => set.has(dir));
  }

  function isManaButtonTileType(type) {
    return MANA_BUTTON_TILE_TYPES.has(type);
  }

  function getManaButtonColor(type) {
    return MANA_BUTTON_COLORS[type] || null;
  }

  function createManaSymbol(color) {
    const symbol = document.createElement("span");
    symbol.className = `mana-symbol mana-${color} mine-mana-symbol`;
    symbol.setAttribute("aria-hidden", "true");
    return symbol;
  }

  function applyManaTheme(theme) {
    const normalized =
      typeof theme === "string" &&
      (theme === "white" || theme === "blue" || theme === "black" || theme === "green")
        ? theme
        : "white";
    document.body.classList.remove(
      "mines-theme-white",
      "mines-theme-blue",
      "mines-theme-black",
      "mines-theme-green"
    );
    document.body.classList.add(`mines-theme-${normalized}`);
  }

  function updateInscription() {
    if (!headerVerseEl) {
      return;
    }
    headerVerseEl.innerHTML = DEFAULT_INSCRIPTION_HTML;
  }

  function createArrowIcon(direction) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("block-arrow", `block-arrow-${direction}`);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M12 3l5.5 5.5h-3.6v11h-3.8v-11H6.5z");
    svg.appendChild(path);
    return svg;
  }

  function createMultiArrowIcon(kind) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("block-arrow-multi", `block-arrow-${kind}`);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "currentColor");
    line.setAttribute("stroke-width", "2");
    line.setAttribute("stroke-linecap", "round");

    const arrowHeads = [];

    if (kind === "horizontal") {
      line.setAttribute("d", "M8 12H16");
      arrowHeads.push("M5 12L8.5 9.5V14.5Z");
      arrowHeads.push("M19 12L15.5 9.5V14.5Z");
    } else if (kind === "vertical") {
      line.setAttribute("d", "M12 8V16");
      arrowHeads.push("M12 5L9.5 8.5H14.5Z");
      arrowHeads.push("M12 19L9.5 15.5H14.5Z");
    } else {
      line.setAttribute("d", "M8 12H16M12 8V16");
      arrowHeads.push("M5 12L8.5 9.5V14.5Z");
      arrowHeads.push("M19 12L15.5 9.5V14.5Z");
      arrowHeads.push("M12 5L9.5 8.5H14.5Z");
      arrowHeads.push("M12 19L9.5 15.5H14.5Z");
    }

    svg.appendChild(line);
    arrowHeads.forEach((pathData) => {
      const head = document.createElementNS("http://www.w3.org/2000/svg", "path");
      head.setAttribute("d", pathData);
      head.setAttribute("fill", "currentColor");
      svg.appendChild(head);
    });
    return svg;
  }

  Object.entries(SOUND_FILES).forEach(([id, src]) => {
    const audio = new Audio(src);
    audio.preload = "auto";
    soundCache.set(id, audio);
  });

  function playSound(id) {
    const base = soundCache.get(id);
    if (!base) {
      return;
    }
    const audio = base.cloneNode(true);
    audio.volume = 0.7;
    audio.play().catch(() => {});
  }

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

  function isInteractionLocked() {
    return solverPlayback.active || isFrozen();
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

  function updateSolverControls() {
    if (!isDM || !solveLevelButton) {
      return;
    }
    const current = liveState || state;
    const available =
      current &&
      current.solver &&
      Array.isArray(current.solver.moves) &&
      current.solver.moves.length > 0;
    solveLevelButton.disabled = !available || solverPlayback.active;
    solveLevelButton.textContent = solverPlayback.active ? "Solving..." : "Solve level";
  }

  function updateGenerationAttempts() {
    if (!generationAttemptsEl) {
      return;
    }
    const current = liveState || state;
    const attempts =
      current && Number.isFinite(current.generationAttempts)
        ? current.generationAttempts
        : 0;
    generationAttemptsEl.textContent = String(attempts);
  }

  function loadSavedMaps() {
    if (!isDM) {
      return;
    }
    try {
      const stored = localStorage.getItem(SAVE_KEY);
      savedMaps = stored ? JSON.parse(stored) : [];
    } catch (error) {
      savedMaps = [];
    }
  }

  function persistSavedMaps() {
    if (!isDM) {
      return;
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(savedMaps));
  }

  function refreshSavedMaps() {
    if (!loadMapSelect) {
      return;
    }
    loadMapSelect.innerHTML = "";
    savedMaps.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.name;
      loadMapSelect.appendChild(option);
    });
    if (loadMapButton) {
      loadMapButton.disabled = savedMaps.length === 0;
    }
  }

  function updateFogToggle() {
    if (!isDM || !fogToggleInput || !state) {
      return;
    }
    fogToggleInput.checked = state.fogEnabled !== false;
  }

  function renderMapEditorTools() {
    if (!isDM || !mapEditorToolsEl) {
      return;
    }
    mapEditorToolsEl.innerHTML = "";
    MAP_BRUSHES.forEach((brush) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "map-editor-tool";
      button.textContent = brush.label;
      if (selectedMapBrush && selectedMapBrush.id === brush.id) {
        button.classList.add("active");
      }
      button.addEventListener("click", () => {
        stopMapBrushDrag();
        if (selectedMapBrush && selectedMapBrush.id === brush.id) {
          selectedMapBrush = null;
        } else {
          selectedMapBrush = brush;
        }
        renderMapEditorTools();
        renderGrid();
      });
      mapEditorToolsEl.appendChild(button);
    });
  }

  function isTileBrush(brush) {
    return Boolean(
      brush &&
        brush.payload &&
        brush.payload.mode === "tile"
    );
  }

  function stopMapBrushDrag() {
    mapBrushDrag.active = false;
    mapBrushDrag.brushId = null;
    mapBrushDrag.paintedKeys.clear();
  }

  function paintTileWithBrush(x, y, options = {}) {
    if (!isDM || !selectedMapBrush || solverPlayback.active) {
      return;
    }
    if (options.dedupe) {
      const key = `${x},${y}`;
      if (mapBrushDrag.paintedKeys.has(key)) {
        return;
      }
      mapBrushDrag.paintedKeys.add(key);
    }
    const payload = {
      x,
      y,
      ...selectedMapBrush.payload,
    };
    socket.emit("editMapTile", payload);
  }

  function normalizeSnapshotTile(tile) {
    if (!tile || !tile.type) {
      return { type: "rock", uncovered: false };
    }
    const uncovered = Boolean(tile.uncovered);
    if (tile.type === "block") {
      return {
        type: "block",
        uncovered,
        directions: Array.isArray(tile.directions) ? tile.directions.slice() : [],
        baseDirections: Array.isArray(tile.baseDirections)
          ? tile.baseDirections.slice()
          : Array.isArray(tile.directions)
            ? tile.directions.slice()
            : [],
      };
    }
    if (isManaButtonTileType(tile.type)) {
      return {
        type: tile.type,
        uncovered,
      };
    }
    if (tile.type === "treasure") {
      return {
        type: "treasure",
        uncovered,
        value: Number.isFinite(tile.value) ? tile.value : 0,
      };
    }
    if (tile.type === "magic-item") {
      return {
        type: "magic-item",
        uncovered,
        itemName:
          typeof tile.itemName === "string" && tile.itemName.trim()
            ? tile.itemName.trim()
            : "",
      };
    }
    if (tile.type === "trap") {
      return {
        type: "trap",
        uncovered,
        message: typeof tile.message === "string" ? tile.message : "",
      };
    }
    if (tile.type === "exit") {
      return { type: "exit", uncovered };
    }
    if (tile.type === "empty") {
      return { type: "empty", uncovered };
    }
    return { type: "rock", uncovered };
  }

  function buildSnapshot(current) {
    return {
      level: current.level,
      seed: current.seed,
      width: current.width,
      height: current.height,
      startArea: current.startArea,
      fogEnabled: current.fogEnabled !== false,
      manaTheme: current.manaTheme || "white",
      singleArrowRotation: Number.isFinite(current.singleArrowRotation)
        ? current.singleArrowRotation
        : 0,
      exit: current.exit,
      generationAttempts: current.generationAttempts || 1,
      solver: current.solver || null,
      tiles: current.tiles.map((row) => row.map((tile) => normalizeSnapshotTile(tile))),
      monsters: Array.isArray(current.monsters)
        ? current.monsters.map((monster) => ({
            id: monster.id,
            type: monster.type,
            x: monster.x,
            y: monster.y,
          }))
        : [],
    };
  }

  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsText(file);
    });
  }

  function inBounds(x, y, width, height) {
    return x >= 0 && x < width && y >= 0 && y < height;
  }

  function buildSolverPlaybackState(current, solver) {
    const tiles = current.tiles.map((row) =>
      row.map((tile) => {
        if (!tile || !tile.type) {
          return { type: "rock", uncovered: false, visible: true };
        }
        if (tile.type === "block") {
          return {
            type: "block",
            uncovered: tile.uncovered,
            directions: tile.directions || [],
            baseDirections: tile.baseDirections || tile.directions || [],
            visible: true,
          };
        }
        if (isManaButtonTileType(tile.type)) {
          return { type: tile.type, uncovered: tile.uncovered, visible: true };
        }
        if (tile.type === "rock") {
          return { type: "rock", uncovered: tile.uncovered, visible: true };
        }
        if (tile.type === "exit") {
          return { type: "exit", uncovered: tile.uncovered, visible: true, exit: true };
        }
        return { type: "empty", uncovered: tile.uncovered, visible: true };
      })
    );
    const fallbackStart = current.startArea
      ? { x: current.startArea.x + 1, y: current.startArea.y + 1 }
      : { x: 1, y: 1 };
    const start = solver && solver.start ? solver.start : fallbackStart;
    const solverToken = {
      id: "solver-preview",
      name: "Solve",
      ownerId: null,
      gold: 0,
      avatar: "",
      initiativeMod: 0,
      x: start.x,
      y: start.y,
      lastMoveAt: 0,
      owned: true,
      ownedBySelf: true,
    };
    return {
      ...current,
      tiles,
      tokens: [solverToken],
      monsters: [],
      combat: null,
      pendingTrap: null,
    };
  }

  function pushSolverBlocks(playbackState, startPos, dir) {
    const tiles = playbackState.tiles;
    const width = playbackState.width;
    const height = playbackState.height;
    const chain = [];
    let cx = startPos.x;
    let cy = startPos.y;

    while (inBounds(cx, cy, width, height)) {
      const tile = tiles[cy][cx];
      if (tile.type !== "block") {
        break;
      }
      if (!tile.directions || !tile.directions.includes(dir.name)) {
        return false;
      }
      chain.push({
        x: cx,
        y: cy,
        uncovered: tile.uncovered,
        directions: tile.directions,
      });
      cx += dir.dx;
      cy += dir.dy;
    }

    if (!inBounds(cx, cy, width, height)) {
      return false;
    }
    const destination = tiles[cy][cx];
    if (destination.type !== "empty") {
      return false;
    }

    for (let i = chain.length - 1; i >= 0; i -= 1) {
      const block = chain[i];
      const destX = block.x + dir.dx;
      const destY = block.y + dir.dy;
      tiles[destY][destX] = {
        type: "block",
        uncovered: block.uncovered,
        directions: block.directions,
      };
    }
    const origin = chain[0];
    tiles[origin.y][origin.x] = { type: "empty", uncovered: true };
    return true;
  }

  function applySolverMove(playbackState, directionName) {
    const token = playbackState.tokens[0];
    if (!token) {
      return false;
    }
    const dir = MOVE_DIRECTIONS.find((entry) => entry.name === directionName);
    if (!dir) {
      return false;
    }
    const target = { x: token.x + dir.dx, y: token.y + dir.dy };
    if (!inBounds(target.x, target.y, playbackState.width, playbackState.height)) {
      return false;
    }
    const targetTile = playbackState.tiles[target.y][target.x];
    if (targetTile.type === "rock") {
      return false;
    }
    if (targetTile.type === "block") {
      if (!pushSolverBlocks(playbackState, target, dir)) {
        return false;
      }
    }
    token.x = target.x;
    token.y = target.y;
    playbackState.tiles[target.y][target.x].uncovered = true;
    return true;
  }

  function stopSolverPlayback(message) {
    if (solverPlayback.timer) {
      clearTimeout(solverPlayback.timer);
      solverPlayback.timer = null;
    }
    solverPlayback.active = false;
    solverPlayback.index = 0;
    solverPlayback.moves = [];
    solverPlayback.state = null;
    if (gridEl) {
      gridEl.classList.remove("solver-playing");
    }
    if (message) {
      setMessage(message);
    }
    state = liveState;
    render();
    updateSolverControls();
  }

  function stepSolverPlayback() {
    if (!solverPlayback.active) {
      return;
    }
    if (solverPlayback.index >= solverPlayback.moves.length) {
      stopSolverPlayback("Solver demo complete.");
      return;
    }
    const directionName = solverPlayback.moves[solverPlayback.index];
    solverPlayback.index += 1;
    const ok = applySolverMove(solverPlayback.state, directionName);
    if (!ok) {
      stopSolverPlayback("Solver demo halted.");
      return;
    }
    render();
    solverPlayback.timer = setTimeout(stepSolverPlayback, 220);
  }

  function startSolverPlayback() {
    if (!isDM || solverPlayback.active) {
      return;
    }
    const current = liveState || state;
    if (!current || !current.solver || !Array.isArray(current.solver.moves)) {
      setMessage("No solver path available.");
      return;
    }
    const moves = current.solver.moves
      .map((move) => (typeof move === "string" ? move : move && move.dir))
      .filter(Boolean);
    if (moves.length === 0) {
      setMessage("No solver path available.");
      return;
    }
    solverPlayback.active = true;
    solverPlayback.index = 0;
    solverPlayback.moves = moves;
    solverPlayback.state = buildSolverPlaybackState(current, current.solver);
    state = solverPlayback.state;
    if (gridEl) {
      gridEl.classList.add("solver-playing");
    }
    selectedTokenId = null;
    selectedMonsterId = null;
    updateActionButtons();
    updateSolverControls();
    render();
    solverPlayback.timer = setTimeout(stepSolverPlayback, 250);
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

  function canControlToken(token) {
    if (token && token.escaped) {
      return false;
    }
    if (isDM) {
      return true;
    }
    return !token.owned || token.ownedBySelf;
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

  function commitTokenName(token, name = editingDraft) {
    if (editingTokenId !== token.id) {
      return;
    }
    socket.emit("setTokenName", { tokenId: token.id, name });
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
              if (!isDM) {
                setMessage("Set your initiative modifier.");
              }
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
            commitTokenName(token, input.value);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancelTokenEdit();
          }
        });
        input.addEventListener("blur", () => {
          commitTokenName(token, input.value);
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
      const items = Array.isArray(token.items)
        ? token.items.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
        : [];
      goldEl.textContent =
        items.length > 0
          ? `Gold: ${token.gold} + ${items.join(" + ")}`
          : `Gold: ${token.gold}`;

      let escapedEl = null;
      if (token.escaped) {
        escapedEl = document.createElement("div");
        escapedEl.className = "token-escaped";
        escapedEl.textContent = "Escaped";
      }

      const initiativeWrap = document.createElement("label");
      initiativeWrap.className = "token-initiative";
      const initiativeLabel = document.createElement("span");
      initiativeLabel.textContent = "Init mod";
      const initiativeInput = document.createElement("input");
      initiativeInput.type = "number";
      initiativeInput.className = "token-initiative-input";
      initiativeInput.value = Number.isFinite(token.initiativeMod)
        ? token.initiativeMod
        : 0;
      initiativeInput.disabled = !canEdit;
      initiativeInput.addEventListener("change", () => {
        socket.emit("setTokenInitiativeMod", {
          tokenId: token.id,
          initiativeMod: initiativeInput.value,
        });
      });
      initiativeWrap.appendChild(initiativeLabel);
      initiativeWrap.appendChild(initiativeInput);

      card.appendChild(nameEl);
      card.appendChild(goldEl);
      if (escapedEl) {
        card.appendChild(escapedEl);
      }
      card.appendChild(initiativeWrap);
      rosterEl.appendChild(card);
    });
  }

  function renderCombat() {
    if (!combatPanel || !combatTracker) {
      return;
    }
    combatTracker.innerHTML = "";
    if (!state || !state.combat) {
      combatPanel.classList.add("combat-inactive");
      const empty = document.createElement("div");
      empty.className = "combat-empty";
      empty.textContent = "No combat active.";
      combatTracker.appendChild(empty);
      if (combatResort) {
        combatResort.disabled = true;
      }
      if (combatPrev) {
        combatPrev.disabled = true;
      }
      if (combatNext) {
        combatNext.disabled = true;
      }
      return;
    }

    combatPanel.classList.remove("combat-inactive");
    if (combatResort) {
      combatResort.disabled = !isDM;
    }
    if (combatPrev) {
      combatPrev.disabled = !isDM;
    }
    if (combatNext) {
      combatNext.disabled = !isDM;
    }

    state.combat.order.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "combat-row";
      if (index === state.combat.currentIndex) {
        row.classList.add("combat-row-active");
      }

      const nameWrap = document.createElement("div");
      nameWrap.className = "combat-name";
      if (entry.avatar) {
        const avatar = document.createElement("div");
        avatar.className = "combat-avatar";
        avatar.style.backgroundImage = `url("${entry.avatar}")`;
        nameWrap.appendChild(avatar);
      }
      const label = document.createElement("span");
      label.textContent = entry.name;
      nameWrap.appendChild(label);

      const initWrap = document.createElement("div");
      initWrap.className = "combat-initiative";
      const modText = document.createElement("span");
      modText.className = "combat-mod";
      modText.textContent = `mod ${entry.mod >= 0 ? "+" : ""}${entry.mod}`;

      const canEditInitiative =
        isDM ||
        (entry.type === "player" &&
          state.tokens.some(
            (token) => token.id === entry.id && (token.ownedBySelf || !token.owned)
          ));

      if (canEditInitiative && entry.type !== "other-monsters") {
        const input = document.createElement("input");
        input.type = "number";
        input.className = "combat-initiative-input";
        input.value = entry.initiative;
        input.addEventListener("change", () => {
          socket.emit("setCombatInitiative", {
            entryId: entry.id,
            initiative: input.value,
          });
        });
        initWrap.appendChild(input);
      } else {
        const value = document.createElement("div");
        value.className = "combat-initiative-value";
        value.textContent = String(entry.initiative);
        initWrap.appendChild(value);
      }

      if (entry.type !== "other-monsters") {
        initWrap.appendChild(modText);
      }

      row.appendChild(nameWrap);
      row.appendChild(initWrap);
      combatTracker.appendChild(row);
    });
  }

  function renderMonsterConfig() {
    if (!isDM || !monsterConfigRow || !state || !state.monsterConfig) {
      return;
    }
    monsterConfigRow.innerHTML = "";
    ["green", "yellow", "red", "violet"].forEach((type) => {
      const config = state.monsterConfig[type] || {};
      const card = document.createElement("div");
      card.className = "monster-config-card";

      const title = document.createElement("div");
      title.className = "monster-config-title";
      title.textContent = `${type} monster`;

      const preview = document.createElement("div");
      preview.className = "monster-config-avatar";
      if (config.avatar) {
        preview.style.backgroundImage = `url("${config.avatar}")`;
        preview.classList.add("has-avatar");
      } else {
        preview.textContent = type.slice(0, 1).toUpperCase();
      }

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.className = "monster-config-input";
      fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) {
          return;
        }
        readImageFile(file)
          .then((dataUrl) => {
            socket.emit("setMonsterConfig", { type, avatar: dataUrl });
          })
          .catch(() => {
            setMessage("That image could not be loaded.");
          });
      });

      const uploadButton = document.createElement("button");
      uploadButton.type = "button";
      uploadButton.className = "monster-config-button";
      uploadButton.textContent = config.avatar ? "Change icon" : "Upload icon";
      uploadButton.addEventListener("click", () => {
        fileInput.click();
      });

      const initWrap = document.createElement("label");
      initWrap.className = "monster-config-init";
      const initLabel = document.createElement("span");
      initLabel.textContent = "Init mod";
      const initInput = document.createElement("input");
      initInput.type = "number";
      initInput.value = Number.isFinite(config.initiativeMod)
        ? config.initiativeMod
        : 0;
      initInput.addEventListener("change", () => {
        socket.emit("setMonsterConfig", { type, initiativeMod: initInput.value });
      });
      initWrap.appendChild(initLabel);
      initWrap.appendChild(initInput);

      card.appendChild(title);
      card.appendChild(preview);
      card.appendChild(fileInput);
      card.appendChild(uploadButton);
      card.appendChild(initWrap);
      monsterConfigRow.appendChild(card);
    });
  }

  function getHistoryState() {
    if (!state || !state.history) {
      return { available: false, canUndo: false, canRedo: false };
    }
    return {
      available: Boolean(state.history.available),
      canUndo: Boolean(state.history.canUndo),
      canRedo: Boolean(state.history.canRedo),
    };
  }

  function requestUndo() {
    if (!state || solverPlayback.active) {
      return;
    }
    socket.emit("undoAction");
  }

  function requestRedo() {
    if (!state || solverPlayback.active) {
      return;
    }
    socket.emit("redoAction");
  }

  function updateActionButtons() {
    if (monsterDelete) {
      monsterDelete.disabled = !isDM || !state || !selectedMonsterId || solverPlayback.active;
    }
    if (combatExit) {
      combatExit.disabled = !isDM || !state || !state.combat || solverPlayback.active;
    }
    const history = getHistoryState();
    if (undoActionButton) {
      undoActionButton.disabled = solverPlayback.active || !history.available || !history.canUndo;
    }
    if (redoActionButton) {
      redoActionButton.disabled = solverPlayback.active || !history.available || !history.canRedo;
    }
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
    if (
      mapBrushDrag.active &&
      (!selectedMapBrush ||
        selectedMapBrush.id !== mapBrushDrag.brushId ||
        !isTileBrush(selectedMapBrush) ||
        solverPlayback.active)
    ) {
      stopMapBrushDrag();
    }
    gridEl.innerHTML = "";
    gridEl.classList.toggle("solver-playing", solverPlayback.active);
    gridEl.classList.toggle(
      "map-editing",
      isDM && Boolean(selectedMapBrush) && !solverPlayback.active
    );
    gridEl.style.gridTemplateColumns = `repeat(${state.width}, var(--cell-size))`;

    const tokenMap = new Map();
    state.tokens.forEach((token) => {
      if (token.escaped || !Number.isFinite(token.x) || !Number.isFinite(token.y)) {
        return;
      }
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
            const directions = normalizeDirections(tile.directions);
            if (directions.length > 0) {
              const arrows = document.createElement("div");
              arrows.className = "block-arrows";
              let usesMulti = false;
              if (
                directions.length === 2 &&
                directions.includes("up") &&
                directions.includes("down")
              ) {
                arrows.appendChild(createMultiArrowIcon("vertical"));
                usesMulti = true;
              } else if (
                directions.length === 2 &&
                directions.includes("left") &&
                directions.includes("right")
              ) {
                arrows.appendChild(createMultiArrowIcon("horizontal"));
                usesMulti = true;
              } else if (directions.length === 4) {
                arrows.appendChild(createMultiArrowIcon("quad"));
                usesMulti = true;
              } else {
                directions.forEach((dir) => {
                  arrows.appendChild(createArrowIcon(dir));
                });
              }
              arrows.dataset.count = String(usesMulti ? 1 : directions.length);
              cell.appendChild(arrows);
            } else {
              content = "?";
            }
          } else if (isManaButtonTileType(tile.type)) {
            const color = getManaButtonColor(tile.type);
            if (color) {
              cell.appendChild(createManaSymbol(color));
            }
          } else if (tile.type === "trap") {
            content = "X";
          } else if (tile.type === "treasure") {
            content = "$";
          } else if (tile.type === "magic-item") {
            content = "★";
          } else if (tile.type === "exit") {
            content = "EXIT";
          } else if (tile.type === "unknown") {
            content = "?";
          } else if (tile.type === "empty" && !isDM && !tile.uncovered && tile.hasNumber) {
            content = "?";
          } else if (
            tile.type === "empty" &&
            Number.isFinite(tile.number) &&
            tile.number > 0 &&
            (tile.uncovered || isDM || !state.fogEnabled)
          ) {
            content = String(tile.number);
          }
          if (content) {
            const text = document.createElement("span");
            text.className = "cell-content";
            if (content === "?") {
              text.classList.add("cell-content-question");
            }
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
            tokenEl.dataset.tokenId = token.id;
            if (token.avatar) {
              tokenEl.classList.add("token-has-avatar");
              tokenEl.style.backgroundImage = `url("${token.avatar}")`;
            } else {
              tokenEl.textContent = token.name
                ? token.name.slice(0, 1).toUpperCase()
                : "?";
            }
            const draggable =
              !isInteractionLocked() &&
              !(isDM && selectedMapBrush) &&
              (isDM || token.ownedBySelf || !token.owned);
            tokenEl.draggable = draggable;
            if (draggable) {
              tokenEl.addEventListener("click", () => {
                if (isDM && selectedMapBrush) {
                  return;
                }
                if (isInteractionLocked()) {
                  return;
                }
                if (!canControlToken(token)) {
                  setMessage("That token belongs to someone else.");
                  return;
                }
                selectedTokenId = token.id;
                selectedMonsterId = null;
                renderGrid();
                updateActionButtons();
              });
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
            if (token.id === selectedTokenId) {
              tokenEl.classList.add("token-selected");
            }
            tokenWrap.appendChild(tokenEl);
          });
          cell.appendChild(tokenWrap);
        }

        const monster = monsterMap.get(tokenKey);
        if (monster) {
          const monsterEl = document.createElement("div");
          monsterEl.className = `monster-marker monster-${monster.type}`;
          if (monster.avatar) {
            monsterEl.classList.add("monster-has-avatar");
            monsterEl.style.backgroundImage = `url("${monster.avatar}")`;
          } else {
            monsterEl.textContent = monster.type.slice(0, 1).toUpperCase();
          }
          if (isDM && !solverPlayback.active && !selectedMapBrush) {
            monsterEl.draggable = true;
            monsterEl.addEventListener("click", () => {
              if (selectedMapBrush) {
                return;
              }
              selectedMonsterId = monster.id;
              selectedTokenId = null;
              renderGrid();
              updateActionButtons();
            });
            monsterEl.addEventListener("dragstart", (event) => {
              dragMonsterId = monster.id;
              dragMonsterFrom = { x: monster.x, y: monster.y };
              event.dataTransfer.setData("text/plain", monster.id);
              event.dataTransfer.effectAllowed = "move";
            });
            monsterEl.addEventListener("dragend", () => {
              dragMonsterId = null;
              dragMonsterFrom = null;
            });
            monsterEl.addEventListener("contextmenu", (event) => {
              event.preventDefault();
              socket.emit("addMonsterToCombat", { monsterId: monster.id });
            });
          } else if (isDM) {
            monsterEl.draggable = false;
          }
          if (monster.id === selectedMonsterId) {
            monsterEl.classList.add("monster-selected");
          }
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
          const activeDrag = dragTokenId || dragMonsterId;
          if (!activeDrag || isInteractionLocked()) {
            return;
          }
          const origin = dragTokenId ? dragFrom : dragMonsterFrom;
          const requiresAdjacentMove = Boolean(dragMonsterId) || !isDM;
          if (origin && requiresAdjacentMove && !isAdjacent(origin, { x, y })) {
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
          const activeDrag = dragTokenId || dragMonsterId;
          if (!activeDrag || isInteractionLocked()) {
            return;
          }
          const origin = dragTokenId ? dragFrom : dragMonsterFrom;
          const requiresAdjacentMove = Boolean(dragMonsterId) || !isDM;
          if (origin && requiresAdjacentMove && !isAdjacent(origin, { x, y })) {
            setMessage("Move one tile at a time.");
            return;
          }
          if (dragTokenId) {
            socket.emit("moveToken", { tokenId: dragTokenId, to: { x, y } });
            dragTokenId = null;
            dragFrom = null;
          } else if (dragMonsterId) {
            socket.emit("moveMonster", { monsterId: dragMonsterId, to: { x, y } });
            dragMonsterId = null;
            dragMonsterFrom = null;
          }
        });

        cell.addEventListener("mousedown", (event) => {
          if (event.button !== 0) {
            return;
          }
          if (!isDM || !selectedMapBrush || solverPlayback.active) {
            return;
          }
          if (!isTileBrush(selectedMapBrush)) {
            return;
          }
          event.preventDefault();
          mapBrushDrag.active = true;
          mapBrushDrag.brushId = selectedMapBrush.id;
          mapBrushDrag.paintedKeys.clear();
          paintTileWithBrush(x, y, { dedupe: true });
        });

        cell.addEventListener("mouseenter", (event) => {
          if (!mapBrushDrag.active) {
            return;
          }
          if ((event.buttons & 1) === 0) {
            stopMapBrushDrag();
            return;
          }
          if (
            !selectedMapBrush ||
            selectedMapBrush.id !== mapBrushDrag.brushId ||
            !isTileBrush(selectedMapBrush) ||
            solverPlayback.active
          ) {
            stopMapBrushDrag();
            return;
          }
          paintTileWithBrush(x, y, { dedupe: true });
        });

        cell.addEventListener("click", (event) => {
          if (isDM && selectedMapBrush && !solverPlayback.active) {
            event.preventDefault();
            if (isTileBrush(selectedMapBrush)) {
              return;
            }
            paintTileWithBrush(x, y);
            return;
          }
          if (
            event.target &&
            (event.target.closest(".token-marker") ||
              event.target.closest(".monster-marker"))
          ) {
            return;
          }
          if (selectedTokenId || selectedMonsterId) {
            selectedTokenId = null;
            selectedMonsterId = null;
            renderGrid();
            updateActionButtons();
          }
        });

        gridEl.appendChild(cell);
      });
    });
  }

  function syncSelection() {
    if (!state) {
      return;
    }
    if (selectedTokenId) {
      const token = state.tokens.find((entry) => entry.id === selectedTokenId);
      if (!token || !canControlToken(token)) {
        selectedTokenId = null;
      }
    }
    if (selectedMonsterId) {
      const monster = state.monsters.find((entry) => entry.id === selectedMonsterId);
      if (!monster || !isDM) {
        selectedMonsterId = null;
      }
    }
  }

  function tryTokenMove(directionName) {
    if (!state || !selectedTokenId || solverPlayback.active) {
      return;
    }
    const token = state.tokens.find((entry) => entry.id === selectedTokenId);
    if (!token) {
      selectedTokenId = null;
      return;
    }
    if (token.escaped) {
      selectedTokenId = null;
      return;
    }
    if (!canControlToken(token)) {
      return;
    }
    const dir = MOVE_DIRECTIONS.find((entry) => entry.name === directionName);
    if (!dir) {
      return;
    }
    const target = { x: token.x + dir.dx, y: token.y + dir.dy };
    if (!state.tiles[target.y] || !state.tiles[target.y][target.x]) {
      return;
    }
    const targetTile = state.tiles[target.y][target.x];
    if (targetTile.type === "rock") {
      return;
    }
    if (
      targetTile.type === "block" &&
      (!targetTile.directions || !targetTile.directions.includes(directionName))
    ) {
      return;
    }
    if (state.tokens.some((entry) => entry.id !== token.id && entry.x === target.x && entry.y === target.y)) {
      return;
    }
    socket.emit("moveToken", { tokenId: token.id, to: target });
  }

  function tryMonsterMove(directionName) {
    if (!state || !selectedMonsterId || !isDM || solverPlayback.active) {
      return;
    }
    const monster = state.monsters.find((entry) => entry.id === selectedMonsterId);
    if (!monster) {
      selectedMonsterId = null;
      return;
    }
    const dir = MOVE_DIRECTIONS.find((entry) => entry.name === directionName);
    if (!dir) {
      return;
    }
    const target = { x: monster.x + dir.dx, y: monster.y + dir.dy };
    if (!state.tiles[target.y] || !state.tiles[target.y][target.x]) {
      return;
    }
    const targetTile = state.tiles[target.y][target.x];
    if (
      targetTile.type === "rock" ||
      targetTile.type === "exit" ||
      isManaButtonTileType(targetTile.type)
    ) {
      return;
    }
    if (
      targetTile.type === "block" &&
      (!targetTile.directions || !targetTile.directions.includes(directionName))
    ) {
      return;
    }
    if (state.monsters.some((entry) => entry.id !== monster.id && entry.x === target.x && entry.y === target.y)) {
      return;
    }
    socket.emit("moveMonster", { monsterId: monster.id, to: target });
  }

  function tryKeyboardMove(directionName) {
    if (!state || isInteractionLocked()) {
      return;
    }
    if (selectedMonsterId) {
      tryMonsterMove(directionName);
      return;
    }
    if (selectedTokenId) {
      tryTokenMove(directionName);
    }
  }

  function render() {
    if (!state) {
      return;
    }
    applyManaTheme(state.manaTheme || "white");
    updateInscription();
    syncSelection();
    if (editingTokenId && !state.tokens.some((token) => token.id === editingTokenId)) {
      cancelTokenEdit();
    }
    if (!editingTokenId) {
      renderRoster();
    }
    renderGrid();
    renderCombat();
    renderMonsterConfig();
    updateActionButtons();
    updateFrozenState();
    updateTrapOverlay();
    updateDmTrapAlert();
    updateGenerationAttempts();
    updateSolverControls();
    updateFogToggle();
    renderMapEditorTools();
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
    liveState = newState;
    if (!solverPlayback.active) {
      state = newState;
      render();
    } else {
      updateGenerationAttempts();
      updateSolverControls();
    }
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

  socket.on("sound", (payload) => {
    if (payload && payload.id) {
      playSound(payload.id);
    }
  });

  socket.on("trapTriggered", (payload) => {
    if (isDM && payload && payload.message) {
      setMessage(payload.message);
    }
  });

  if (isDM) {
    loadSavedMaps();
    refreshSavedMaps();
    renderMapEditorTools();
  }

  window.addEventListener("keydown", (event) => {
    if (editingTokenId) {
      return;
    }
    if (solverPlayback.active) {
      return;
    }
    const target = event.target;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }
    const key = String(event.key || "").toLowerCase();
    const hasMod = event.ctrlKey || event.metaKey;
    if (hasMod && !event.altKey) {
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        requestUndo();
        return;
      }
      if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        requestRedo();
        return;
      }
    }
    const keyMap = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    const direction = keyMap[event.key];
    if (!direction) {
      return;
    }
    event.preventDefault();
    tryKeyboardMove(direction);
  });

  window.addEventListener("mouseup", () => {
    stopMapBrushDrag();
  });

  window.addEventListener("blur", () => {
    stopMapBrushDrag();
  });

  if (isDM && dmTrapConfirm) {
    dmTrapConfirm.addEventListener("click", () => {
      socket.emit("resolveTrap");
    });
  }

  if (isDM && fogToggleInput) {
    fogToggleInput.addEventListener("change", () => {
      socket.emit("setFogOfWar", { enabled: fogToggleInput.checked });
    });
  }

  if (isDM && startGameButton) {
    startGameButton.addEventListener("click", () => {
      if (solverPlayback.active) {
        stopSolverPlayback();
      }
      const level = levelInput ? levelInput.value : 1;
      const seed = seedInput ? seedInput.value : 42;
      socket.emit("startGame", {
        level: Number.parseInt(level, 10),
        seed: Number.parseInt(seed, 10),
      });
    });
  }

  if (isDM && solveLevelButton) {
    solveLevelButton.addEventListener("click", () => {
      if (solverPlayback.active) {
        return;
      }
      if (!window.confirm("Demonstrate the solution?")) {
        return;
      }
      startSolverPlayback();
    });
  }

  if (isDM && saveMapButton) {
    saveMapButton.addEventListener("click", () => {
      const current = liveState || state;
      if (!current) {
        return;
      }
      const defaultName = `Level ${current.level} (${current.width}x${current.height})`;
      const name = window.prompt("Save map as:", defaultName);
      if (!name) {
        return;
      }
      const trimmed = name.trim();
      if (!trimmed) {
        return;
      }
      const snapshot = buildSnapshot(current);
      const entry = {
        id: `${Date.now()}`,
        name: trimmed,
        savedAt: Date.now(),
        snapshot,
      };
      const existingIndex = savedMaps.findIndex((saved) => saved.name === trimmed);
      if (existingIndex !== -1) {
        if (!window.confirm(`Overwrite \"${trimmed}\"?`)) {
          return;
        }
        savedMaps[existingIndex] = entry;
      } else {
        savedMaps.push(entry);
      }
      persistSavedMaps();
      refreshSavedMaps();
      if (loadMapSelect) {
        loadMapSelect.value = entry.id;
      }
      setMessage(`Saved map \"${trimmed}\".`);
    });
  }

  if (isDM && exportMapButton) {
    exportMapButton.addEventListener("click", () => {
      const current = liveState || state;
      if (!current) {
        return;
      }
      const snapshot = buildSnapshot(current);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `echoing-mines-level-${current.level}-${current.width}x${current.height}-${timestamp}.json`;
      const payload = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setMessage(`Exported map as \"${filename}\".`);
    });
  }

  if (isDM && loadMapButton) {
    loadMapButton.addEventListener("click", () => {
      if (!loadMapSelect) {
        return;
      }
      const selectedId = loadMapSelect.value;
      const entry = savedMaps.find((saved) => saved.id === selectedId);
      if (!entry) {
        return;
      }
      if (!window.confirm(`Load map \"${entry.name}\"?`)) {
        return;
      }
      if (solverPlayback.active) {
        stopSolverPlayback();
      }
      socket.emit("loadMap", entry.snapshot);
    });
  }

  if (isDM && loadMapDiskButton && loadMapDiskInput) {
    loadMapDiskButton.addEventListener("click", () => {
      loadMapDiskInput.value = "";
      loadMapDiskInput.click();
    });

    loadMapDiskInput.addEventListener("change", async () => {
      const file = loadMapDiskInput.files && loadMapDiskInput.files[0];
      if (!file) {
        return;
      }
      try {
        const text = await readFileText(file);
        const parsed = JSON.parse(text);
        const snapshot = parsed && parsed.snapshot ? parsed.snapshot : parsed;
        if (!snapshot || !Array.isArray(snapshot.tiles)) {
          setMessage("Selected file is not a valid Echoing Mines snapshot.");
          return;
        }
        if (solverPlayback.active) {
          stopSolverPlayback();
        }
        socket.emit("loadMap", {
          source: "disk-file",
          snapshot,
        });
        setMessage(`Loading map from "${file.name}"...`);
      } catch (error) {
        setMessage("Could not parse map file.");
      } finally {
        loadMapDiskInput.value = "";
      }
    });
  }

  if (combatResort) {
    combatResort.addEventListener("click", () => {
      if (!isDM) {
        return;
      }
      socket.emit("resortCombat");
    });
  }

  if (combatPrev) {
    combatPrev.addEventListener("click", () => {
      if (!isDM) {
        return;
      }
      socket.emit("retreatCombat");
    });
  }

  if (combatNext) {
    combatNext.addEventListener("click", () => {
      if (!isDM) {
        return;
      }
      socket.emit("advanceCombat");
    });
  }

  if (combatExit) {
    combatExit.addEventListener("click", () => {
      if (!isDM) {
        return;
      }
      socket.emit("exitCombat");
    });
  }

  if (monsterDelete) {
    monsterDelete.addEventListener("click", () => {
      if (!isDM || !selectedMonsterId) {
        return;
      }
      socket.emit("deleteMonster", { monsterId: selectedMonsterId });
      selectedMonsterId = null;
      updateActionButtons();
      renderGrid();
    });
  }

  if (undoActionButton) {
    undoActionButton.addEventListener("click", () => {
      requestUndo();
    });
  }

  if (redoActionButton) {
    redoActionButton.addEventListener("click", () => {
      requestRedo();
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
      if (solverPlayback.active) {
        stopSolverPlayback();
      }
      socket.emit("resetGame");
    });
  }
})();
