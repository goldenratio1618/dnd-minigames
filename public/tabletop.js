(() => {
  const socket = io("/tabletop");

  const STORAGE_SESSION_KEY = "gairos_tabletop_session";
  const STORAGE_LOG_MIN_KEY = "gairos_tabletop_log_minimized";

  const elements = {
    authStatus: document.getElementById("auth-status"),
    authForms: document.getElementById("auth-forms"),
    logoutButton: document.getElementById("logout-button"),
    mainStatus: document.getElementById("main-status"),

    loginForm: document.getElementById("login-form"),
    loginUsername: document.getElementById("login-username"),
    loginPassword: document.getElementById("login-password"),

    registerForm: document.getElementById("register-form"),
    registerUsername: document.getElementById("register-username"),
    registerPassword: document.getElementById("register-password"),
    registerRole: document.getElementById("register-role"),
    registerDmCode: document.getElementById("register-dm-code"),

    characterCard: document.getElementById("character-card"),
    characterList: document.getElementById("character-list"),
    characterForm: document.getElementById("character-form"),
    characterId: document.getElementById("character-id"),
    characterName: document.getElementById("character-name"),
    characterSheetUrl: document.getElementById("character-sheet-url"),
    characterFeatsText: document.getElementById("character-feats-text"),
    characterTokenImage: document.getElementById("character-token-image"),
    characterSpeed: document.getElementById("character-speed"),
    characterMaxHp: document.getElementById("character-max-hp"),
    characterStrengthMod: document.getElementById("character-strength-mod"),
    characterIsdc: document.getElementById("character-isdc"),

    statblockCard: document.getElementById("statblock-card"),
    statblockList: document.getElementById("statblock-list"),
    statblockForm: document.getElementById("statblock-form"),
    statblockId: document.getElementById("statblock-id"),
    statblockName: document.getElementById("statblock-name"),
    statblockMode: document.getElementById("statblock-mode"),
    statblockSheetUrl: document.getElementById("statblock-sheet-url"),
    statblockSheetName: document.getElementById("statblock-sheet-name"),
    statblockColumnName: document.getElementById("statblock-column-name"),
    statblockManualText: document.getElementById("statblock-manual-text"),
    statblockTokenImage: document.getElementById("statblock-token-image"),

    mapCard: document.getElementById("map-card"),
    mapSelect: document.getElementById("map-select"),
    mapLoad: document.getElementById("map-load"),
    mapCreate: document.getElementById("map-create"),
    mapDelete: document.getElementById("map-delete"),
    mapCreateName: document.getElementById("map-create-name"),
    mapCreateRows: document.getElementById("map-create-rows"),
    mapCreateCols: document.getElementById("map-create-cols"),
    mapScenarioType: document.getElementById("map-scenario-type"),
    mapBackgroundInput: document.getElementById("map-background-input"),
    interactionMode: document.getElementById("interaction-mode"),
    terrainBrush: document.getElementById("terrain-brush"),
    tokenLayerSelect: document.getElementById("token-layer-select"),
    tokenRoster: document.getElementById("token-roster"),

    selectedTokenControls: document.getElementById("selected-token-controls"),
    tokenLayerToTokens: document.getElementById("token-layer-to-tokens"),
    tokenLayerToGm: document.getElementById("token-layer-to-gm"),
    tokenToggleAuto: document.getElementById("token-toggle-auto"),
    tokenDelete: document.getElementById("token-delete"),

    rollCard: document.getElementById("roll-card"),
    rollForm: document.getElementById("roll-form"),
    rollEntitySelect: document.getElementById("roll-entity-select"),
    rollSkill: document.getElementById("roll-skill"),
    rollType: document.getElementById("roll-type"),
    rollAdvantage: document.getElementById("roll-advantage"),
    rollFlatModifier: document.getElementById("roll-flat-modifier"),
    rollFortuneTens: document.getElementById("roll-fortune-tens"),
    rollTargetDieIndex: document.getElementById("roll-target-die-index"),
    rollPortentValue: document.getElementById("roll-portent-value"),
    rollShiftingMode: document.getElementById("roll-shifting-mode"),
    rollUseMiracle: document.getElementById("roll-use-miracle"),
    rollBonusOverride: document.getElementById("roll-bonus-override"),
    rollModifierList: document.getElementById("roll-modifier-list"),
    allySourceUser: document.getElementById("ally-source-user"),
    allyModifierId: document.getElementById("ally-modifier-id"),
    requestAllyModifier: document.getElementById("request-ally-modifier"),
    approvedModifierList: document.getElementById("approved-modifier-list"),
    rollResult: document.getElementById("roll-result"),

    dmToolsCard: document.getElementById("dm-tools-card"),
    forageTerrain: document.getElementById("forage-terrain"),
    forageRoll: document.getElementById("forage-roll"),
    groupRollSkill: document.getElementById("group-roll-skill"),
    groupRollSend: document.getElementById("group-roll-send"),
    initiativeStart: document.getElementById("initiative-start"),
    initiativeNext: document.getElementById("initiative-next"),
    initiativeStop: document.getElementById("initiative-stop"),

    injuryEntitySelect: document.getElementById("injury-entity-select"),
    injuryOverkill: document.getElementById("injury-overkill"),
    injuryRoll: document.getElementById("injury-roll"),
    injuryResult: document.getElementById("injury-result"),

    mapGridWrap: document.getElementById("map-grid-wrap"),
    mapGridCells: document.getElementById("map-grid-cells"),
    mapGridTokens: document.getElementById("map-grid-tokens"),

    logPanel: document.getElementById("log-panel"),
    logToggle: document.getElementById("log-toggle"),
    logEntries: document.getElementById("log-entries"),
    chatForm: document.getElementById("chat-form"),
    chatInput: document.getElementById("chat-input"),
  };

  const state = {
    snapshot: null,
    selectedTokenId: null,
    selectedPlacement: null,
    checkedSelfModifiers: new Set(),
    checkedApprovedModifierIds: new Set(),
    approvedModifierEntries: [],
    lastStatusTimeout: null,
  };

  function emit(eventName, payload) {
    socket.emit(eventName, payload || {});
  }

  function setStatus(message, isError = false) {
    const text = String(message || "");
    if (elements.mainStatus) {
      elements.mainStatus.textContent = text;
      elements.mainStatus.style.color = isError ? "#ff8a8a" : "#9fb5ac";
    }
    if (state.lastStatusTimeout) {
      clearTimeout(state.lastStatusTimeout);
      state.lastStatusTimeout = null;
    }
    if (text) {
      state.lastStatusTimeout = setTimeout(() => {
        if (elements.mainStatus) {
          elements.mainStatus.textContent = "Ready";
          elements.mainStatus.style.color = "#9fb5ac";
        }
      }, 3000);
    }
  }

  function user() {
    return state.snapshot && state.snapshot.auth ? state.snapshot.auth.user : null;
  }

  function isAuthenticated() {
    return Boolean(user());
  }

  function isDm() {
    return user() && user().role === "dm";
  }

  function userId() {
    return user() ? user().id : null;
  }

  function activeMap() {
    return state.snapshot && state.snapshot.scene ? state.snapshot.scene.map : null;
  }

  function characters() {
    return (state.snapshot && state.snapshot.characters) || [];
  }

  function statblocks() {
    return (state.snapshot && state.snapshot.statblocks) || [];
  }

  function connectedUsers() {
    return (state.snapshot && state.snapshot.connectedUsers) || [];
  }

  function ownCharacters() {
    const me = userId();
    return characters().filter((character) => character.ownerUserId === me);
  }

  function mapOfModifierCatalog() {
    return (state.snapshot && state.snapshot.config && state.snapshot.config.modifierCatalog) || {};
  }

  function getTokenById(tokenId) {
    const map = activeMap();
    if (!map || !Array.isArray(map.tokens)) {
      return null;
    }
    return map.tokens.find((token) => token.id === tokenId) || null;
  }

  function initials(name) {
    const words = String(name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    if (words.length === 0) {
      return "?";
    }
    return words.map((word) => word[0].toUpperCase()).join("");
  }

  function sanitizeId(text) {
    return String(text || "").replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  function formatTimestamp(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read image file."));
      reader.readAsDataURL(file);
    });
  }

  function resetCharacterForm() {
    elements.characterId.value = "";
    elements.characterName.value = "";
    elements.characterSheetUrl.value = "";
    elements.characterFeatsText.value = "";
    elements.characterTokenImage.value = "";
    elements.characterSpeed.value = "";
    elements.characterMaxHp.value = "";
    elements.characterStrengthMod.value = "";
    elements.characterIsdc.value = "";
  }

  function resetStatblockForm() {
    elements.statblockId.value = "";
    elements.statblockName.value = "";
    elements.statblockMode.value = "column";
    elements.statblockSheetUrl.value = "";
    elements.statblockSheetName.value = "Augmented beasts";
    elements.statblockColumnName.value = "";
    elements.statblockManualText.value = "";
    elements.statblockTokenImage.value = "";
  }

  function renderAuth() {
    const current = user();
    if (current) {
      elements.authStatus.textContent = `${current.username} (${current.role})`;
      elements.authForms.classList.add("tt-hidden");
      elements.logoutButton.classList.remove("tt-hidden");
    } else {
      elements.authStatus.textContent = "Not logged in";
      elements.authForms.classList.remove("tt-hidden");
      elements.logoutButton.classList.add("tt-hidden");
      const defaultRole = document.body.dataset.defaultRole === "dm" ? "dm" : "player";
      elements.registerRole.value = defaultRole;
    }
  }

  function renderCharacters() {
    const me = userId();
    const canSeeAll = isDm();
    const list = canSeeAll ? characters() : ownCharacters();

    elements.characterList.innerHTML = "";
    list.forEach((character) => {
      const item = document.createElement("div");
      item.className = "tt-list-item";

      const left = document.createElement("div");
      left.textContent = character.name;
      item.appendChild(left);

      const controls = document.createElement("div");
      controls.className = "tt-grid2";

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => {
        elements.characterId.value = character.id;
        elements.characterName.value = character.name || "";
        elements.characterSheetUrl.value = character.sheetUrl || "";
        elements.characterTokenImage.value = character.tokenImage || "";
        const parsed = character.parsedSheet || {};
        elements.characterFeatsText.value = Array.isArray(parsed.feats) ? parsed.feats.join("\n") : "";
        elements.characterSpeed.value = parsed.speed || "";
        elements.characterMaxHp.value = parsed.maxHp || "";
        elements.characterStrengthMod.value = parsed.strengthModifier || "";
        elements.characterIsdc.value = parsed.italicizedSkillDc || "";
      });
      controls.appendChild(editButton);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => {
        if (!window.confirm(`Delete ${character.name}?`)) {
          return;
        }
        emit("character:delete", { id: character.id });
      });
      controls.appendChild(deleteButton);

      item.appendChild(controls);

      if (character.sheetError) {
        const errorEl = document.createElement("div");
        errorEl.textContent = `Sheet parse warning: ${character.sheetError}`;
        errorEl.style.color = "#ff9a9a";
        errorEl.style.fontSize = "0.7rem";
        item.appendChild(errorEl);
      }

      elements.characterList.appendChild(item);
    });

    elements.characterCard.classList.toggle("tt-hidden", !isAuthenticated());

    if (isDm()) {
      const select = elements.rollEntitySelect;
      const currentValue = select.value;
      const canKeep = list.some((character) => `character:${character.id}` === currentValue);
      if (!canKeep && ownCharacters().length > 0) {
        elements.rollEntitySelect.value = `character:${ownCharacters()[0].id}`;
      }
    }
  }

  function renderStatblocks() {
    elements.statblockCard.classList.toggle("tt-hidden", !isDm());
    if (!isDm()) {
      return;
    }

    elements.statblockList.innerHTML = "";
    statblocks().forEach((statblock) => {
      const item = document.createElement("div");
      item.className = "tt-list-item";

      const left = document.createElement("div");
      left.textContent = statblock.name;
      item.appendChild(left);

      const controls = document.createElement("div");
      controls.className = "tt-grid2";

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => {
        elements.statblockId.value = statblock.id;
        elements.statblockName.value = statblock.name || "";
        elements.statblockMode.value = statblock.mode || "column";
        elements.statblockSheetUrl.value = statblock.sheetUrl || "";
        elements.statblockSheetName.value = statblock.sheetName || "Augmented beasts";
        elements.statblockColumnName.value = statblock.columnName || "";
        elements.statblockManualText.value = statblock.manualText || "";
        elements.statblockTokenImage.value = statblock.tokenImage || "";
      });
      controls.appendChild(editButton);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => {
        if (!window.confirm(`Delete ${statblock.name}?`)) {
          return;
        }
        emit("statblock:delete", { id: statblock.id });
      });
      controls.appendChild(deleteButton);

      item.appendChild(controls);

      if (statblock.sheetError) {
        const errorEl = document.createElement("div");
        errorEl.textContent = `Sheet parse warning: ${statblock.sheetError}`;
        errorEl.style.color = "#ff9a9a";
        errorEl.style.fontSize = "0.7rem";
        item.appendChild(errorEl);
      }

      elements.statblockList.appendChild(item);
    });
  }

  function renderMaps() {
    const show = isDm();
    elements.mapCard.classList.toggle("tt-hidden", !show);
    if (!show) {
      return;
    }

    const maps = (state.snapshot && state.snapshot.maps) || [];
    const activeMapId = state.snapshot && state.snapshot.scene ? state.snapshot.scene.activeMapId : null;

    const previousValue = elements.mapSelect.value;
    elements.mapSelect.innerHTML = "";
    maps.forEach((map) => {
      const option = document.createElement("option");
      option.value = map.id;
      option.textContent = `${map.name} (${map.cols}x${map.rows})`;
      elements.mapSelect.appendChild(option);
    });

    if (maps.some((map) => map.id === previousValue)) {
      elements.mapSelect.value = previousValue;
    } else if (activeMapId) {
      elements.mapSelect.value = activeMapId;
    }

    renderTokenRoster();
    renderSelectedTokenControls();
  }

  function tokenLabelFromSpecial(cell) {
    if (!cell || !cell.specialType) {
      return "";
    }
    const labels = {
      echoing_mine: "MINE",
      echoing_treasure: "TREASURE",
      echoing_arrow_up: "^",
      echoing_arrow_down: "v",
      echoing_arrow_left: "<",
      echoing_arrow_right: ">",
      echoing_visibility_unknown: "?",
      echoing_visibility_number: "#",
    };
    return labels[cell.specialType] || "";
  }

  function canCurrentUserControlToken(token) {
    const me = userId();
    if (!me || !token) {
      return false;
    }
    if (isDm()) {
      return true;
    }
    if (token.sourceType === "character") {
      const character = characters().find((candidate) => candidate.id === token.sourceId);
      return Boolean(character && character.ownerUserId === me);
    }
    return token.ownerUserId === me;
  }

  function handleCellClick(x, y, cell) {
    if (!state.snapshot) {
      return;
    }

    const mode = isDm() ? elements.interactionMode.value : "move";

    if (isDm() && mode === "paint") {
      emit("map:paintTerrain", {
        x,
        y,
        brush: elements.terrainBrush.value,
      });
      return;
    }

    if (isDm() && mode === "place") {
      if (!state.selectedPlacement) {
        setStatus("Select a token source first.", true);
        return;
      }
      emit("token:place", {
        x,
        y,
        layer: elements.tokenLayerSelect.value,
        ...state.selectedPlacement,
      });
      return;
    }

    if (state.selectedTokenId) {
      emit("token:move", {
        tokenId: state.selectedTokenId,
        x,
        y,
      });
      return;
    }

    if (cell && cell.blockType === "door") {
      emit("map:interactDoor", { x, y });
    }
  }

  function renderMapGrid() {
    const map = activeMap();
    elements.mapGridCells.innerHTML = "";
    elements.mapGridTokens.innerHTML = "";

    if (!map) {
      return;
    }

    const cellSize = window.innerWidth < 860 ? 30 : 34;

    elements.mapGridCells.style.gridTemplateColumns = `repeat(${map.cols}, ${cellSize}px)`;
    elements.mapGridCells.style.gridTemplateRows = `repeat(${map.rows}, ${cellSize}px)`;
    elements.mapGridTokens.style.gridTemplateColumns = `repeat(${map.cols}, ${cellSize}px)`;
    elements.mapGridTokens.style.gridTemplateRows = `repeat(${map.rows}, ${cellSize}px)`;
    elements.mapGridCells.style.backgroundImage = map.background && map.background.imageDataUrl
      ? `url(${map.background.imageDataUrl})`
      : "none";

    map.terrain.forEach((row, y) => {
      row.forEach((cell, x) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tt-cell";
        button.classList.add(`tt-terrain-${sanitizeId(cell.blockType || "empty")}`);
        if (cell.blockType === "door" && cell.doorOpen) {
          button.classList.add("tt-door-open");
        }
        if (cell.difficultType === "visible") {
          button.classList.add("tt-difficult-visible");
        }

        const label = tokenLabelFromSpecial(cell);
        if (label) {
          const special = document.createElement("div");
          special.className = "tt-special";
          special.textContent = label;
          button.appendChild(special);
        }

        button.addEventListener("click", () => handleCellClick(x, y, cell));
        elements.mapGridCells.appendChild(button);
      });
    });

    map.tokens.forEach((token) => {
      const holder = document.createElement("div");
      holder.className = "tt-token-holder";
      holder.style.gridColumnStart = String(token.x + 1);
      holder.style.gridRowStart = String(token.y + 1);
      holder.style.width = `${cellSize}px`;
      holder.style.height = `${cellSize}px`;
      holder.style.position = "relative";

      const tokenEl = document.createElement("div");
      tokenEl.className = "tt-token";
      if (token.id === state.selectedTokenId) {
        tokenEl.classList.add("tt-token-selected");
      }

      if (token.tokenImage) {
        const image = document.createElement("img");
        image.src = token.tokenImage;
        image.alt = token.name;
        tokenEl.appendChild(image);
      } else {
        tokenEl.textContent = initials(token.name);
      }

      const nameEl = document.createElement("div");
      nameEl.className = "tt-token-name";
      nameEl.textContent = token.name;
      tokenEl.appendChild(nameEl);

      if (token.movementInfo && Number.isFinite(token.movementInfo.max)) {
        const moveEl = document.createElement("div");
        moveEl.className = "tt-move-info";
        if (token.movementInfo.overLimit) {
          moveEl.classList.add("over");
        }
        moveEl.textContent = `${token.movementInfo.spent}/${token.movementInfo.max}`;
        tokenEl.appendChild(moveEl);
      }

      tokenEl.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (state.selectedTokenId === token.id) {
          state.selectedTokenId = null;
        } else {
          state.selectedTokenId = token.id;
        }
        renderSelectedTokenControls();
        renderMapGrid();
      });

      if (canCurrentUserControlToken(token)) {
        tokenEl.title = "Click to select, then click a destination tile to move.";
      } else {
        tokenEl.title = token.name;
      }

      holder.appendChild(tokenEl);
      elements.mapGridTokens.appendChild(holder);
    });
  }

  function renderTokenRoster() {
    if (!isDm()) {
      elements.tokenRoster.innerHTML = "";
      return;
    }

    elements.tokenRoster.innerHTML = "";

    const allEntries = [
      ...characters().map((character) => ({
        id: character.id,
        type: "character",
        name: character.name,
        tokenImage: character.tokenImage,
      })),
      ...statblocks().map((statblock) => ({
        id: statblock.id,
        type: "statblock",
        name: statblock.name,
        tokenImage: statblock.tokenImage,
      })),
    ];

    allEntries.forEach((entry) => {
      const item = document.createElement("div");
      item.className = "tt-list-item";

      const label = document.createElement("div");
      label.textContent = `${entry.name} (${entry.type})`;
      item.appendChild(label);

      const place = document.createElement("button");
      place.type = "button";
      place.textContent = "Use";
      place.addEventListener("click", () => {
        state.selectedPlacement = {
          sourceType: entry.type,
          sourceId: entry.id,
          name: entry.name,
          tokenImage: entry.tokenImage || "",
        };
        elements.interactionMode.value = "place";
        setStatus(`Selected ${entry.name} for placement.`);
        renderTokenRoster();
      });
      item.appendChild(place);

      if (
        state.selectedPlacement &&
        state.selectedPlacement.sourceType === entry.type &&
        state.selectedPlacement.sourceId === entry.id
      ) {
        item.style.borderColor = "#d9a441";
      }

      elements.tokenRoster.appendChild(item);
    });

    const customItem = document.createElement("div");
    customItem.className = "tt-list-item";
    const customLabel = document.createElement("div");
    customLabel.textContent = "Custom token";
    customItem.appendChild(customLabel);
    const customButton = document.createElement("button");
    customButton.type = "button";
    customButton.textContent = "Use";
    customButton.addEventListener("click", () => {
      const name = window.prompt("Custom token name:", "Custom");
      if (!name) {
        return;
      }
      const tokenImage = window.prompt("Token image URL or data URI (optional):", "") || "";
      state.selectedPlacement = {
        sourceType: "custom",
        sourceId: "",
        name,
        tokenImage,
      };
      elements.interactionMode.value = "place";
      setStatus(`Selected custom token ${name}.`);
      renderTokenRoster();
    });
    customItem.appendChild(customButton);
    elements.tokenRoster.appendChild(customItem);
  }

  function renderSelectedTokenControls() {
    if (!isDm() || !state.selectedTokenId) {
      elements.selectedTokenControls.classList.add("tt-hidden");
      return;
    }

    const token = getTokenById(state.selectedTokenId);
    if (!token) {
      elements.selectedTokenControls.classList.add("tt-hidden");
      return;
    }

    elements.selectedTokenControls.classList.remove("tt-hidden");
  }

  function deriveModifiersFromEntity(entity) {
    if (!entity) {
      return [];
    }
    if (Array.isArray(entity.availableModifiers) && entity.availableModifiers.length > 0) {
      return entity.availableModifiers.slice();
    }

    const catalog = mapOfModifierCatalog();
    const feats = new Set((entity.parsedSheet && entity.parsedSheet.feats) || []);
    const resolved = [];
    Object.values(catalog).forEach((modifier) => {
      if ((modifier.featNames || []).some((featName) => feats.has(featName))) {
        resolved.push(modifier.id);
      }
    });
    return resolved;
  }

  function doesModifierApply(modifierMeta, rollType, skillName) {
    if (!modifierMeta || !Array.isArray(modifierMeta.appliesTo)) {
      return true;
    }
    const appliesTo = modifierMeta.appliesTo.map((entry) => String(entry || "").toLowerCase());
    const normalizedRollType = String(rollType || "").toLowerCase();
    const normalizedSkill = String(skillName || "").toLowerCase();

    if (appliesTo.includes("any")) {
      return true;
    }
    if (appliesTo.includes(normalizedRollType)) {
      return true;
    }
    if (appliesTo.includes(normalizedSkill)) {
      return true;
    }
    if (appliesTo.includes("any_skill") && normalizedRollType.includes("skill")) {
      return true;
    }
    if (
      appliesTo.includes("beseech_the_gods") &&
      (normalizedRollType === "beseech_the_gods" || normalizedRollType === "prepared_prayer")
    ) {
      return true;
    }
    return false;
  }

  function parseEntitySelectValue(value) {
    const raw = String(value || "");
    const separator = raw.indexOf(":");
    if (separator < 0) {
      return null;
    }
    const type = raw.slice(0, separator);
    const id = raw.slice(separator + 1);
    if (type === "character") {
      const character = characters().find((candidate) => candidate.id === id);
      if (!character) {
        return null;
      }
      return {
        type,
        id,
        entity: character,
      };
    }
    if (type === "statblock") {
      const statblock = statblocks().find((candidate) => candidate.id === id);
      if (!statblock) {
        return null;
      }
      return {
        type,
        id,
        entity: statblock,
      };
    }
    return null;
  }

  function renderRollEntityOptions() {
    const currentValue = elements.rollEntitySelect.value;
    elements.rollEntitySelect.innerHTML = "";

    const options = [];
    if (isDm()) {
      characters().forEach((character) => {
        options.push({ value: `character:${character.id}`, label: `PC: ${character.name}` });
      });
      statblocks().forEach((statblock) => {
        options.push({ value: `statblock:${statblock.id}`, label: `NPC: ${statblock.name}` });
      });
    } else {
      ownCharacters().forEach((character) => {
        options.push({ value: `character:${character.id}`, label: character.name });
      });
    }

    options.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.value;
      option.textContent = entry.label;
      elements.rollEntitySelect.appendChild(option);
    });

    if (options.some((entry) => entry.value === currentValue)) {
      elements.rollEntitySelect.value = currentValue;
    } else if (options.length > 0) {
      elements.rollEntitySelect.value = options[0].value;
    }

    renderRollModifiers();
  }

  function renderRollModifiers() {
    const parsed = parseEntitySelectValue(elements.rollEntitySelect.value);
    const entity = parsed ? parsed.entity : null;
    const selfModifiers = deriveModifiersFromEntity(entity);
    const catalog = mapOfModifierCatalog();

    const keepChecked = new Set();

    elements.rollModifierList.innerHTML = "";
    selfModifiers.forEach((modifierId) => {
      const meta = catalog[modifierId];
      if (!doesModifierApply(meta, elements.rollType.value, elements.rollSkill.value)) {
        return;
      }
      const row = document.createElement("label");
      row.className = "tt-list-item";

      const left = document.createElement("span");
      left.textContent = meta ? `${modifierId} - ${meta.phase}` : modifierId;
      row.appendChild(left);

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.checkedSelfModifiers.has(modifierId);
      if (checkbox.checked) {
        keepChecked.add(modifierId);
      }
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          state.checkedSelfModifiers.add(modifierId);
        } else {
          state.checkedSelfModifiers.delete(modifierId);
        }
      });
      row.appendChild(checkbox);

      elements.rollModifierList.appendChild(row);
    });

    state.checkedSelfModifiers = keepChecked;

    elements.approvedModifierList.innerHTML = "";
    const keepApproved = new Set();
    state.approvedModifierEntries.forEach((entry) => {
      const row = document.createElement("label");
      row.className = "tt-list-item";
      const text = document.createElement("span");
      text.textContent = `${entry.modifierId} (approved by ${entry.byUsername})`;
      row.appendChild(text);

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.checkedApprovedModifierIds.has(entry.approvalId);
      if (checkbox.checked) {
        keepApproved.add(entry.approvalId);
      }
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          state.checkedApprovedModifierIds.add(entry.approvalId);
        } else {
          state.checkedApprovedModifierIds.delete(entry.approvalId);
        }
      });
      row.appendChild(checkbox);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "x";
      remove.addEventListener("click", () => {
        state.approvedModifierEntries = state.approvedModifierEntries.filter(
          (candidate) => candidate.approvalId !== entry.approvalId
        );
        state.checkedApprovedModifierIds.delete(entry.approvalId);
        renderRollModifiers();
      });
      row.appendChild(remove);

      elements.approvedModifierList.appendChild(row);
    });
    state.checkedApprovedModifierIds = keepApproved;

    renderAllyModifierSelectors();

    const parsedSheet = entity && entity.parsedSheet ? entity.parsedSheet : null;
    if (parsedSheet && parsedSheet.skills) {
      const normalizedSkill = String(elements.rollSkill.value || "").trim().toLowerCase();
      if (!normalizedSkill) {
        const firstSkill = Object.keys(parsedSheet.skills)[0];
        if (firstSkill) {
          elements.rollSkill.value = firstSkill;
        }
      }
    }
  }

  function renderAllyModifierSelectors() {
    const me = userId();
    const map = activeMap();
    const modifierSources = [];
    if (map && Array.isArray(map.tokens)) {
      map.tokens
        .filter((token) => token.layer === "tokens")
        .forEach((token) => {
          let entity = null;
          let sourceUserId = null;
          if (token.sourceType === "character") {
            entity = characters().find((candidate) => candidate.id === token.sourceId) || null;
            sourceUserId = entity ? entity.ownerUserId : null;
          } else if (token.sourceType === "statblock") {
            entity = statblocks().find((candidate) => candidate.id === token.sourceId) || null;
            sourceUserId = entity ? entity.ownerUserId : null;
          }
          if (!entity || !sourceUserId || sourceUserId === me) {
            return;
          }
          const modifiers = deriveModifiersFromEntity(entity).filter((modifierId) => {
            const meta = mapOfModifierCatalog()[modifierId];
            return Boolean(meta && meta.requiresApproval);
          });
          if (modifiers.length === 0) {
            return;
          }
          modifierSources.push({
            sourceUserId,
            modifiers,
          });
        });
    }

    const eligibleUserIds = new Set(modifierSources.map((source) => source.sourceUserId));
    const users = connectedUsers().filter(
      (candidate) => candidate.id !== me && eligibleUserIds.has(candidate.id)
    );
    const previousUser = elements.allySourceUser.value;

    elements.allySourceUser.innerHTML = "";
    users.forEach((candidate) => {
      const option = document.createElement("option");
      option.value = candidate.id;
      option.textContent = `${candidate.username} (${candidate.role})`;
      elements.allySourceUser.appendChild(option);
    });

    if (users.some((candidate) => candidate.id === previousUser)) {
      elements.allySourceUser.value = previousUser;
    }

    const selectedUserId = elements.allySourceUser.value;
    const availableModifiersForUser = new Set();
    modifierSources.forEach((source) => {
      if (source.sourceUserId !== selectedUserId) {
        return;
      }
      source.modifiers.forEach((modifierId) => availableModifiersForUser.add(modifierId));
    });

    const previousModifier = elements.allyModifierId.value;
    elements.allyModifierId.innerHTML = "";
    Array.from(availableModifiersForUser).forEach((modifierId) => {
      const option = document.createElement("option");
      option.value = modifierId;
      option.textContent = modifierId;
      elements.allyModifierId.appendChild(option);
    });

    if (
      Array.from(elements.allyModifierId.options).some((option) => option.value === previousModifier)
    ) {
      elements.allyModifierId.value = previousModifier;
    }
  }

  function renderRollAndInjurySelectors() {
    renderRollEntityOptions();

    const previousInjury = elements.injuryEntitySelect.value;
    elements.injuryEntitySelect.innerHTML = "";

    const entries = [];
    if (isDm()) {
      characters().forEach((character) => {
        entries.push({ value: `character:${character.id}`, label: `PC: ${character.name}` });
      });
      statblocks().forEach((statblock) => {
        entries.push({ value: `statblock:${statblock.id}`, label: `NPC: ${statblock.name}` });
      });
    } else {
      ownCharacters().forEach((character) => {
        entries.push({ value: `character:${character.id}`, label: character.name });
      });
    }

    entries.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.value;
      option.textContent = entry.label;
      elements.injuryEntitySelect.appendChild(option);
    });

    if (entries.some((entry) => entry.value === previousInjury)) {
      elements.injuryEntitySelect.value = previousInjury;
    } else if (entries.length > 0) {
      elements.injuryEntitySelect.value = entries[0].value;
    }

    elements.dmToolsCard.classList.toggle("tt-hidden", !isDm());
  }

  function renderLogs() {
    const logs = (state.snapshot && state.snapshot.logs) || [];
    elements.logEntries.innerHTML = "";

    logs.slice(-200).forEach((entry) => {
      const block = document.createElement("div");
      block.className = "tt-log-entry";

      const meta = document.createElement("div");
      meta.className = "tt-log-meta";
      meta.textContent = `${formatTimestamp(entry.timestamp)} ${entry.actor ? `| ${entry.actor}` : ""} | ${entry.type}`;
      block.appendChild(meta);

      const message = document.createElement("div");
      message.textContent = entry.message;
      block.appendChild(message);

      if (entry.type === "roll" && entry.details && entry.details.roll && entry.details.roll.d20) {
        const rollLine = document.createElement("div");
        rollLine.className = "tt-log-meta";
        rollLine.textContent = `d20s: ${entry.details.roll.d20.dice.join(", ")} | selected ${entry.details.roll.d20.selected} | total ${entry.details.roll.total}`;
        block.appendChild(rollLine);
      }

      elements.logEntries.appendChild(block);
    });

    elements.logEntries.scrollTop = elements.logEntries.scrollHeight;
  }

  function renderMapAndInitiativeSummary() {
    const map = activeMap();
    if (!map) {
      return;
    }

    const initiative = state.snapshot.scene && state.snapshot.scene.initiative;
    if (initiative && initiative.active && initiative.order.length > 0) {
      const current = initiative.order[initiative.currentIndex];
      if (current) {
        setStatus(`Round ${initiative.round} - Turn: ${current.name}`);
      }
    }
  }

  function renderAll() {
    if (!state.snapshot) {
      return;
    }

    renderAuth();
    renderCharacters();
    renderStatblocks();
    renderMaps();
    renderRollAndInjurySelectors();
    renderMapGrid();
    renderLogs();
    renderMapAndInitiativeSummary();
  }

  function parseEntitySelectionForPayload(selectValue) {
    const parsed = parseEntitySelectValue(selectValue);
    if (!parsed) {
      return null;
    }
    if (parsed.type === "character") {
      return {
        characterId: parsed.id,
      };
    }
    return {
      statblockId: parsed.id,
    };
  }

  function selectedSelfModifierPayloads() {
    const payloads = [];
    state.checkedSelfModifiers.forEach((modifierId) => {
      const entry = { id: modifierId, external: false };
      if (modifierId === "fortune_over_finesse") {
        entry.sacrificedTens = Number.parseInt(elements.rollFortuneTens.value, 10) || 0;
      }
      if (modifierId === "portent") {
        entry.portentValue = Number.parseInt(elements.rollPortentValue.value, 10) || 0;
      }
      payloads.push(entry);
    });
    return payloads;
  }

  function selectedApprovedModifierPayloads() {
    const payloads = [];
    state.approvedModifierEntries.forEach((entry) => {
      if (!state.checkedApprovedModifierIds.has(entry.approvalId)) {
        return;
      }
      payloads.push({ id: entry.modifierId, external: true });
    });
    return payloads;
  }

  function selectedApprovalIds() {
    return state.approvedModifierEntries
      .filter((entry) => state.checkedApprovedModifierIds.has(entry.approvalId))
      .map((entry) => entry.approvalId);
  }

  elements.loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    emit("auth:login", {
      username: elements.loginUsername.value,
      password: elements.loginPassword.value,
    });
  });

  elements.registerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    emit("auth:register", {
      username: elements.registerUsername.value,
      password: elements.registerPassword.value,
      role: elements.registerRole.value,
      dmCode: elements.registerDmCode.value,
    });
  });

  elements.logoutButton.addEventListener("click", () => {
    emit("auth:logout");
    localStorage.removeItem(STORAGE_SESSION_KEY);
  });

  elements.characterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    emit("character:save", {
      id: elements.characterId.value || undefined,
      name: elements.characterName.value,
      sheetUrl: elements.characterSheetUrl.value,
      featsText: elements.characterFeatsText.value,
      tokenImage: elements.characterTokenImage.value,
      speedOverride: elements.characterSpeed.value,
      maxHpOverride: elements.characterMaxHp.value,
      strengthModifier: elements.characterStrengthMod.value,
      italicizedSkillDc: elements.characterIsdc.value,
    });
    resetCharacterForm();
  });

  elements.statblockForm.addEventListener("submit", (event) => {
    event.preventDefault();
    emit("statblock:save", {
      id: elements.statblockId.value || undefined,
      name: elements.statblockName.value,
      mode: elements.statblockMode.value,
      sheetUrl: elements.statblockSheetUrl.value,
      sheetName: elements.statblockSheetName.value,
      columnName: elements.statblockColumnName.value,
      manualText: elements.statblockManualText.value,
      tokenImage: elements.statblockTokenImage.value,
    });
    resetStatblockForm();
  });

  elements.mapCreate.addEventListener("click", () => {
    emit("map:create", {
      name: elements.mapCreateName.value || "New Battlemap",
      rows: elements.mapCreateRows.value,
      cols: elements.mapCreateCols.value,
      scenarioType: elements.mapScenarioType.value,
    });
  });

  elements.mapLoad.addEventListener("click", () => {
    emit("map:load", { id: elements.mapSelect.value });
  });

  elements.mapDelete.addEventListener("click", () => {
    const mapId = elements.mapSelect.value;
    const selected = state.snapshot.maps.find((entry) => entry.id === mapId);
    if (!selected) {
      return;
    }
    if (!window.confirm(`Delete map ${selected.name}?`)) {
      return;
    }
    emit("map:delete", { id: mapId });
  });

  elements.mapBackgroundInput.addEventListener("change", async () => {
    const file = elements.mapBackgroundInput.files && elements.mapBackgroundInput.files[0];
    if (!file) {
      return;
    }
    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      emit("map:setBackground", { imageDataUrl });
    } catch (error) {
      setStatus(error.message, true);
    }
    elements.mapBackgroundInput.value = "";
  });

  elements.interactionMode.addEventListener("change", () => {
    if (elements.interactionMode.value !== "place") {
      state.selectedPlacement = null;
      renderTokenRoster();
    }
  });

  elements.tokenLayerToTokens.addEventListener("click", () => {
    if (!state.selectedTokenId) {
      return;
    }
    emit("token:setLayer", {
      tokenId: state.selectedTokenId,
      layer: "tokens",
    });
  });

  elements.tokenLayerToGm.addEventListener("click", () => {
    if (!state.selectedTokenId) {
      return;
    }
    emit("token:setLayer", {
      tokenId: state.selectedTokenId,
      layer: "gm",
    });
  });

  elements.tokenDelete.addEventListener("click", () => {
    if (!state.selectedTokenId) {
      return;
    }
    if (!window.confirm("Delete selected token?")) {
      return;
    }
    emit("token:delete", {
      tokenId: state.selectedTokenId,
    });
    state.selectedTokenId = null;
  });

  elements.tokenToggleAuto.addEventListener("click", () => {
    if (!state.selectedTokenId) {
      return;
    }
    const token = getTokenById(state.selectedTokenId);
    if (!token) {
      return;
    }
    emit("token:update", {
      tokenId: token.id,
      autoMove: !token.autoMove,
    });
  });

  elements.rollEntitySelect.addEventListener("change", () => {
    renderRollModifiers();
  });

  elements.rollType.addEventListener("change", () => {
    renderRollModifiers();
  });

  elements.rollSkill.addEventListener("input", () => {
    renderRollModifiers();
  });

  elements.requestAllyModifier.addEventListener("click", () => {
    const targetUserId = elements.allySourceUser.value;
    const modifierId = elements.allyModifierId.value;
    if (!targetUserId || !modifierId) {
      setStatus("Choose an ally and modifier first.", true);
      return;
    }
    emit("roll:requestModifierApproval", {
      targetUserId,
      modifierId,
      context: {
        skillName: elements.rollSkill.value,
        rollType: elements.rollType.value,
      },
    });
    setStatus(`Requested ${modifierId} from ally.`);
  });

  elements.allySourceUser.addEventListener("change", () => {
    renderAllyModifierSelectors();
  });

  elements.rollForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const entityPayload = parseEntitySelectionForPayload(elements.rollEntitySelect.value);
    if (!entityPayload) {
      setStatus("Select who is rolling first.", true);
      return;
    }

    const payload = {
      ...entityPayload,
      skillName: elements.rollSkill.value,
      rollType: elements.rollType.value,
      advantageLevel: Number.parseInt(elements.rollAdvantage.value, 10) || 0,
      flatModifier: Number.parseInt(elements.rollFlatModifier.value, 10) || 0,
      bonusOverride:
        elements.rollBonusOverride.value === ""
          ? undefined
          : Number.parseInt(elements.rollBonusOverride.value, 10) || 0,
      modifiers: [...selectedSelfModifierPayloads(), ...selectedApprovedModifierPayloads()],
      approvalIds: selectedApprovalIds(),
      targetDieIndexForReroll: Number.parseInt(elements.rollTargetDieIndex.value, 10) || 0,
      targetDieIndexForSmallFortunes: Number.parseInt(elements.rollTargetDieIndex.value, 10) || 0,
      shiftingFortunesMode: elements.rollShiftingMode.value,
      useMiracleWorkerPenalty: elements.rollUseMiracle.checked,
    };

    emit("roll:skill", payload);
  });

  elements.forageRoll.addEventListener("click", () => {
    emit("forage:roll", {
      terrain: elements.forageTerrain.value,
    });
  });

  elements.groupRollSend.addEventListener("click", () => {
    const skillName = elements.groupRollSkill.value.trim();
    if (!skillName) {
      setStatus("Enter a skill to request.", true);
      return;
    }
    emit("roll:groupRequest", {
      skillName,
      rollType: elements.rollType.value,
    });
  });

  elements.initiativeStart.addEventListener("click", () => {
    emit("initiative:start");
  });

  elements.initiativeNext.addEventListener("click", () => {
    emit("initiative:next");
  });

  elements.initiativeStop.addEventListener("click", () => {
    emit("initiative:stop");
  });

  elements.injuryRoll.addEventListener("click", () => {
    const parsed = parseEntitySelectionForPayload(elements.injuryEntitySelect.value);
    if (!parsed) {
      setStatus("Select who takes the injury checks.", true);
      return;
    }
    emit("injury:roll", {
      ...parsed,
      overkill: Number.parseInt(elements.injuryOverkill.value, 10) || 0,
    });
  });

  elements.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = elements.chatInput.value.trim();
    if (!text) {
      return;
    }
    emit("chat:message", { text });
    elements.chatInput.value = "";
  });

  elements.logToggle.addEventListener("click", () => {
    const minimized = elements.logPanel.classList.toggle("minimized");
    elements.logToggle.textContent = minimized ? "Open" : "Minimize";
    localStorage.setItem(STORAGE_LOG_MIN_KEY, minimized ? "1" : "0");
  });

  socket.on("connect", () => {
    setStatus("Connected");
    const token = localStorage.getItem(STORAGE_SESSION_KEY);
    if (token) {
      emit("auth:resume", {
        sessionToken: token,
      });
    }
  });

  socket.on("disconnect", () => {
    setStatus("Disconnected", true);
  });

  socket.on("tabletop:state", (snapshot) => {
    state.snapshot = snapshot;
    if (snapshot && snapshot.auth && snapshot.auth.sessionToken) {
      localStorage.setItem(STORAGE_SESSION_KEY, snapshot.auth.sessionToken);
    }
    renderAll();
  });

  socket.on("tabletop:error", (payload) => {
    setStatus(payload && payload.message ? payload.message : "Unknown error", true);
  });

  socket.on("tabletop:notice", (payload) => {
    setStatus(payload && payload.message ? payload.message : "Notice");
  });

  socket.on("roll:modifierApprovalRequested", (payload) => {
    const modifierId = payload && payload.modifierId ? payload.modifierId : "modifier";
    const requesterName = payload && payload.requesterName ? payload.requesterName : "Player";
    const approve = window.confirm(`${requesterName} asks to use ${modifierId}. Approve?`);
    emit("roll:modifierApprovalResponse", {
      approvalId: payload.approvalId,
      approve,
    });
  });

  socket.on("roll:modifierApprovalResolved", (payload) => {
    if (!payload || !payload.approvalId) {
      return;
    }
    if (!payload.approved) {
      setStatus(`${payload.modifierId} request was denied.`, true);
      return;
    }

    if (state.approvedModifierEntries.some((entry) => entry.approvalId === payload.approvalId)) {
      return;
    }

    state.approvedModifierEntries.push({
      approvalId: payload.approvalId,
      modifierId: payload.modifierId,
      byUserId: payload.byUserId,
      byUsername: payload.byUsername,
    });
    state.checkedApprovedModifierIds.add(payload.approvalId);
    renderRollModifiers();
    setStatus(`${payload.modifierId} approved by ${payload.byUsername}.`);
  });

  socket.on("roll:result", (payload) => {
    const roll = payload && payload.roll;
    if (!roll) {
      return;
    }
    const diceText = roll.d20 && Array.isArray(roll.d20.dice) ? roll.d20.dice.join(", ") : "-";
    const guidanceText = Array.isArray(roll.guidingDice) && roll.guidingDice.length > 0
      ? ` | extra: ${roll.guidingDice.map((entry) => `${entry.type}:${entry.roll}`).join(", ")}`
      : "";
    const isdcText =
      roll.isdcCheck && roll.isdcCheck.required
        ? ` | ISDC ${roll.isdcCheck.passed ? "pass" : "fail"} (${roll.isdcCheck.total}/${roll.isdcCheck.dc})`
        : "";
    elements.rollResult.textContent =
      `${payload.entityName}: ${roll.total} | d20s: ${diceText}${guidanceText}${isdcText}`;
  });

  socket.on("roll:groupRequested", (payload) => {
    setStatus(`${payload.requestedBy} requested: ${payload.skillName}`, false);
    elements.rollSkill.value = payload.skillName;
    elements.rollType.value = payload.rollType;

    if (Array.isArray(payload.characterOptions) && payload.characterOptions.length > 0) {
      const first = payload.characterOptions[0];
      const wantedValue = `character:${first.id}`;
      if (Array.from(elements.rollEntitySelect.options).some((option) => option.value === wantedValue)) {
        elements.rollEntitySelect.value = wantedValue;
      }
    }
    renderRollModifiers();
  });

  socket.on("forage:result", (payload) => {
    if (!payload || !payload.herb) {
      return;
    }
    const rarity = String(payload.rarity || "").replace("_", " ");
    setStatus(`Forage: ${payload.herb.name} (${rarity})`);
  });

  socket.on("injury:result", (payload) => {
    if (!payload) {
      return;
    }
    const injury = payload.injuryCheck.passed
      ? "No injury"
      : `${payload.injuryCheck.tier}: ${payload.injuryCheck.injury}`;
    const text = `${payload.entityName} | death check ${payload.deathCheck.total}/${payload.deathCheck.dc} (${payload.deathCheck.passed ? "pass" : "fail"}) | injury ${payload.injuryCheck.total}/${payload.injuryCheck.dc}: ${injury}`;
    elements.injuryResult.textContent = text;
  });

  const minimizedByDefault = localStorage.getItem(STORAGE_LOG_MIN_KEY) === "1";
  if (minimizedByDefault) {
    elements.logPanel.classList.add("minimized");
    elements.logToggle.textContent = "Open";
  }
})();
