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
    menuToggle: document.getElementById("menu-toggle"),
    menuButtons: document.getElementById("menu-buttons"),
    menuAccount: document.getElementById("menu-account"),
    menuCharacter: document.getElementById("menu-character"),
    menuRolls: document.getElementById("menu-rolls"),
    menuLog: document.getElementById("menu-log"),
    menuUtilities: document.getElementById("menu-utilities"),

    characterCard: document.getElementById("character-card"),
    characterSelect: document.getElementById("character-select"),
    characterNewButton: document.getElementById("character-new-button"),
    characterRefreshButton: document.getElementById("character-refresh-button"),
    characterTokenPreview: document.getElementById("character-token-preview"),
    characterTokenBadge: document.getElementById("character-token-badge"),
    characterTokenLabel: document.getElementById("character-token-label"),
    characterStatsSummary: document.getElementById("character-stats-summary"),
    characterStatsDetailGrid: document.getElementById("character-stats-detail-grid"),
    characterList: document.getElementById("character-list"),
    characterForm: document.getElementById("character-form"),
    characterId: document.getElementById("character-id"),
    characterName: document.getElementById("character-name"),
    characterSheetUrl: document.getElementById("character-sheet-url"),
    characterFeatsText: document.getElementById("character-feats-text"),
    characterTokenImage: document.getElementById("character-token-image"),
    characterTokenFile: document.getElementById("character-token-file"),
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
    rollSkillSelect: document.getElementById("roll-skill-select"),
    rollTypeDisplay: document.getElementById("roll-type-display"),
    rollAdvantage: document.getElementById("roll-advantage"),
    rollSkillModifier: document.getElementById("roll-skill-modifier"),
    rollTargetDieWrap: document.getElementById("roll-target-die-wrap"),
    rollTargetDieIndex: document.getElementById("roll-target-die-index"),
    rollShiftingWrap: document.getElementById("roll-shifting-wrap"),
    rollShiftingMode: document.getElementById("roll-shifting-mode"),
    rollMiracleWrap: document.getElementById("roll-miracle-wrap"),
    rollUseMiracle: document.getElementById("roll-use-miracle"),
    rollBonusOverride: document.getElementById("roll-bonus-override"),
    rollModifierList: document.getElementById("roll-modifier-list"),
    allySourceUser: document.getElementById("ally-source-user"),
    allyModifierId: document.getElementById("ally-modifier-id"),
    requestAllyModifier: document.getElementById("request-ally-modifier"),
    approvedModifierList: document.getElementById("approved-modifier-list"),
    rollResult: document.getElementById("roll-result"),

    injuryCard: document.getElementById("injury-card"),
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
    selectedCharacterId: null,
    pendingCharacterSelection: null,
    lastRollSkillKey: null,
    activeMenu: "character",
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
    if (elements.characterTokenFile) {
      elements.characterTokenFile.value = "";
    }
    elements.characterSpeed.value = "";
    elements.characterMaxHp.value = "";
    elements.characterStrengthMod.value = "";
    elements.characterIsdc.value = "";
    renderCharacterPanels(null);
  }

  function normalizeLabel(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function numericInputValue(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? String(parsed) : "";
  }

  function formatStatKey(key) {
    return String(key || "")
      .split(" ")
      .filter(Boolean)
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(" ");
  }

  function formatStatValue(value) {
    if (value === null || value === undefined || value === "") {
      return "-";
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    return String(value);
  }

  function renderStatGrid(container, pairs) {
    if (!container) {
      return;
    }
    container.innerHTML = "";
    pairs.forEach((pair) => {
      const item = document.createElement("div");
      item.className = "tt-stat-item";

      const key = document.createElement("div");
      key.className = "tt-stat-key";
      key.textContent = formatStatKey(pair.key);
      item.appendChild(key);

      const value = document.createElement("div");
      value.className = "tt-stat-value";
      value.textContent = formatStatValue(pair.value);
      item.appendChild(value);

      container.appendChild(item);
    });
  }

  function renderCharacterPanels(character) {
    const badge = elements.characterTokenBadge;
    const label = elements.characterTokenLabel;
    if (badge) {
      badge.innerHTML = "";
      if (character && character.tokenImage) {
        const image = document.createElement("img");
        image.src = character.tokenImage;
        image.alt = character.name || "Token";
        badge.appendChild(image);
      } else {
        badge.textContent = character ? initials(character.name) : "?";
      }
    }
    if (label) {
      label.textContent = character ? `${character.name} token` : "No token selected";
    }

    const parsed = (character && character.parsedSheet) || {};
    const currentValues = parsed.currentValues && typeof parsed.currentValues === "object"
      ? parsed.currentValues
      : {};
    const lookup = new Map(
      Object.keys(currentValues).map((key) => [normalizeLabel(key), currentValues[key]])
    );
    const statValue = (primary, fallback = "") => {
      if (lookup.has(primary)) {
        return lookup.get(primary);
      }
      if (fallback && lookup.has(fallback)) {
        return lookup.get(fallback);
      }
      return "";
    };

    const summaryPairs = [
      { key: "Level", value: statValue("level") },
      { key: "Current HP", value: statValue("current hp", "hp") },
      { key: "Current Mana", value: statValue("current mana", "mana") },
      { key: "Humility", value: statValue("humility") },
      { key: "DR", value: statValue("dr") },
      { key: "AC", value: statValue("ac") },
      { key: "Speed", value: statValue("speed") || parsed.speed },
    ];
    renderStatGrid(elements.characterStatsSummary, summaryPairs);

    const detailPairs = [
      { key: "Max HP", value: parsed.maxHp },
      { key: "Strength Mod", value: parsed.strengthModifier },
      { key: "ISDC", value: parsed.italicizedSkillDc },
    ];
    const shownDetailKeys = new Set([
      ...detailPairs.map((entry) => normalizeLabel(entry.key)),
      "current hp",
      "hp",
      "current mana",
      "mana",
      "level",
      "humility",
      "dr",
      "ac",
      "speed",
    ]);
    Object.keys(currentValues)
      .sort((a, b) => a.localeCompare(b))
      .forEach((key) => {
        const normalized = normalizeLabel(key);
        if (shownDetailKeys.has(normalized)) {
          return;
        }
        detailPairs.push({
          key: formatStatKey(normalized),
          value: currentValues[key],
        });
      });
    renderStatGrid(elements.characterStatsDetailGrid, detailPairs);
  }

  function fillCharacterForm(character) {
    if (!character) {
      resetCharacterForm();
      return;
    }
    elements.characterId.value = character.id || "";
    elements.characterName.value = character.name || "";
    elements.characterSheetUrl.value = character.sheetUrl || "";
    elements.characterTokenImage.value = character.tokenImage || "";
    if (elements.characterTokenFile) {
      elements.characterTokenFile.value = "";
    }
    const parsed = character.parsedSheet || {};
    elements.characterFeatsText.value = Array.isArray(parsed.feats) ? parsed.feats.join("\n") : "";
    elements.characterSpeed.value = numericInputValue(parsed.speed);
    elements.characterMaxHp.value = numericInputValue(parsed.maxHp);
    elements.characterStrengthMod.value = numericInputValue(parsed.strengthModifier);
    elements.characterIsdc.value = numericInputValue(parsed.italicizedSkillDc);
    state.selectedCharacterId = character.id || null;
    if (elements.characterSelect) {
      elements.characterSelect.value = character.id || "";
    }
    renderCharacterPanels(character);
    const rollValue = character && character.id ? `character:${character.id}` : "";
    if (
      rollValue &&
      Array.from(elements.rollEntitySelect.options).some((option) => option.value === rollValue)
    ) {
      elements.rollEntitySelect.value = rollValue;
      state.checkedSelfModifiers.clear();
      state.checkedApprovedModifierIds.clear();
      state.lastRollSkillKey = null;
      renderRollSkillOptions();
      renderRollModifiers();
    }
  }

  function selectCharacterById(characterId, availableCharacters, shouldPopulate = true) {
    const list = Array.isArray(availableCharacters) ? availableCharacters : isDm() ? characters() : ownCharacters();
    const found = list.find((character) => character.id === characterId) || null;
    state.selectedCharacterId = found ? found.id : null;
    if (elements.characterSelect) {
      elements.characterSelect.value = found ? found.id : "";
    }
    if (shouldPopulate) {
      if (found) {
        fillCharacterForm(found);
      } else {
        resetCharacterForm();
      }
    }
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
      if (state.activeMenu === "account" && isAuthenticated()) {
        state.activeMenu = "character";
      }
    } else {
      elements.authStatus.textContent = "Not logged in";
      elements.authForms.classList.remove("tt-hidden");
      elements.logoutButton.classList.add("tt-hidden");
      const defaultRole = document.body.dataset.defaultRole === "dm" ? "dm" : "player";
      elements.registerRole.value = defaultRole;
      state.activeMenu = "account";
    }
  }

  function menuButtonsList() {
    return [
      elements.menuAccount,
      elements.menuCharacter,
      elements.menuRolls,
      elements.menuLog,
      elements.menuUtilities,
    ].filter(Boolean);
  }

  function setActiveMenu(menuKey) {
    state.activeMenu = menuKey;
    applyMenuVisibility();
  }

  function applyMenuVisibility() {
    const panel = state.activeMenu || "character";
    const panelElements = document.querySelectorAll("[data-menu-panel]");
    panelElements.forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }
      const target = node.getAttribute("data-menu-panel");
      const shouldShow = target === panel;
      node.classList.toggle("tt-menu-hidden", !shouldShow);
    });

    if (elements.menuButtons) {
      menuButtonsList().forEach((button) => {
        if (!button) {
          return;
        }
        const buttonPanel = button.id.replace("menu-", "");
        button.classList.toggle("active", buttonPanel === panel);
      });
    }

    if (panel !== "log" && elements.logPanel) {
      elements.logPanel.classList.remove("minimized");
      elements.logToggle.textContent = "Minimize";
    }
  }

  function renderCharacters() {
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
        fillCharacterForm(character);
      });
      controls.appendChild(editButton);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => {
        if (!window.confirm(`Delete ${character.name}?`)) {
          return;
        }
        if (state.selectedCharacterId === character.id) {
          state.selectedCharacterId = null;
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
    if (!elements.characterSelect) {
      return;
    }

    const previousSelectedId = state.selectedCharacterId;
    const pending = state.pendingCharacterSelection;
    let selectedId = "";
    let shouldPopulateSelection = false;

    elements.characterSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "New character";
    elements.characterSelect.appendChild(placeholder);

    list.forEach((character) => {
      const option = document.createElement("option");
      option.value = character.id;
      option.textContent = character.name || "Unnamed Character";
      elements.characterSelect.appendChild(option);
    });

    if (pending) {
      let matched = null;
      if (pending.id) {
        matched = list.find((character) => character.id === pending.id) || null;
      }
      if (!matched && pending.name) {
        const byName = list
          .filter(
            (character) =>
              normalizeLabel(character.name) === pending.name &&
              (!pending.ownerUserId || character.ownerUserId === pending.ownerUserId)
          )
          .sort(
            (a, b) =>
              new Date(b.updatedAt || 0).getTime() -
              new Date(a.updatedAt || 0).getTime()
          );
        matched = byName[0] || null;
      }
      if (matched) {
        selectedId = matched.id;
        shouldPopulateSelection = true;
        state.pendingCharacterSelection = null;
      } else if (Date.now() - Number(pending.submittedAt || 0) > 20_000) {
        state.pendingCharacterSelection = null;
      }
    }

    if (!selectedId && previousSelectedId && list.some((character) => character.id === previousSelectedId)) {
      selectedId = previousSelectedId;
    }

    if (
      !selectedId &&
      elements.characterId.value &&
      list.some((character) => character.id === elements.characterId.value)
    ) {
      selectedId = elements.characterId.value;
    }

    if (
      !selectedId &&
      list.length === 1 &&
      !elements.characterId.value &&
      !elements.characterName.value.trim()
    ) {
      selectedId = list[0].id;
      shouldPopulateSelection = true;
    }

    elements.characterSelect.value = selectedId || "";
    state.selectedCharacterId = selectedId || null;
    const selectedCharacter = list.find((character) => character.id === selectedId) || null;

    if (shouldPopulateSelection && selectedId) {
      fillCharacterForm(selectedCharacter);
    } else {
      renderCharacterPanels(selectedCharacter);
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

  function placeTokenAt(x, y, placement) {
    if (!placement) {
      return;
    }
    emit("token:place", {
      x,
      y,
      layer: elements.tokenLayerSelect.value,
      ...placement,
    });
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
      placeTokenAt(x, y, state.selectedPlacement);
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
        if (isDm()) {
          button.addEventListener("dragover", (event) => {
            event.preventDefault();
          });
          button.addEventListener("drop", (event) => {
            event.preventDefault();
            const raw = event.dataTransfer
              ? event.dataTransfer.getData("application/x-tabletop-placement") ||
                event.dataTransfer.getData("text/plain")
              : "";
            if (!raw) {
              return;
            }
            try {
              const placement = JSON.parse(raw);
              if (!placement || !placement.sourceType || !placement.name) {
                return;
              }
              placeTokenAt(x, y, placement);
            } catch (error) {
              setStatus("Could not read dropped token.", true);
            }
          });
        }
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

      if (isDm()) {
        holder.addEventListener("dragover", (event) => {
          event.preventDefault();
        });
        holder.addEventListener("drop", (event) => {
          event.preventDefault();
          const raw = event.dataTransfer
            ? event.dataTransfer.getData("application/x-tabletop-placement") ||
              event.dataTransfer.getData("text/plain")
            : "";
          if (!raw) {
            return;
          }
          try {
            const placement = JSON.parse(raw);
            if (!placement || !placement.sourceType || !placement.name) {
              return;
            }
            placeTokenAt(token.x, token.y, placement);
          } catch (error) {
            setStatus("Could not read dropped token.", true);
          }
        });
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

    const choosePlacement = (entry) => {
      state.selectedPlacement = {
        sourceType: entry.type,
        sourceId: entry.id,
        name: entry.name,
        tokenImage: entry.tokenImage || "",
      };
      elements.interactionMode.value = "place";
      setStatus(`Selected ${entry.name} for placement.`);
      renderTokenRoster();
    };

    allEntries.forEach((entry) => {
      const item = document.createElement("div");
      item.className = "tt-list-item";
      item.draggable = true;
      item.title = "Drag onto the map to place this token.";
      item.addEventListener("dragstart", (event) => {
        const payload = JSON.stringify({
          sourceType: entry.type,
          sourceId: entry.id,
          name: entry.name,
          tokenImage: entry.tokenImage || "",
        });
        if (event.dataTransfer) {
          event.dataTransfer.setData("application/x-tabletop-placement", payload);
          event.dataTransfer.setData("text/plain", payload);
          event.dataTransfer.effectAllowed = "copy";
        }
      });

      const label = document.createElement("div");
      label.className = "tt-row";
      const tokenBubble = document.createElement("div");
      tokenBubble.className = "tt-roster-token";
      if (entry.tokenImage) {
        const image = document.createElement("img");
        image.src = entry.tokenImage;
        image.alt = entry.name;
        tokenBubble.appendChild(image);
      } else {
        tokenBubble.textContent = initials(entry.name);
      }
      label.appendChild(tokenBubble);
      const labelText = document.createElement("div");
      labelText.textContent = `${entry.name} (${entry.type})`;
      label.appendChild(labelText);
      item.appendChild(label);

      const place = document.createElement("button");
      place.type = "button";
      place.textContent = "Use";
      place.addEventListener("click", () => choosePlacement(entry));
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
      const placement = {
        sourceType: "custom",
        sourceId: "",
        name,
        tokenImage,
      };
      state.selectedPlacement = placement;
      elements.interactionMode.value = "place";
      setStatus(`Selected custom token ${name}.`);
      renderTokenRoster();
    });
    customItem.appendChild(customButton);
    customItem.draggable = true;
    customItem.title = "Drag onto the map to place a custom token.";
    customItem.addEventListener("dragstart", (event) => {
      const name = window.prompt("Custom token name:", "Custom");
      if (!name) {
        event.preventDefault();
        return;
      }
      const tokenImage = window.prompt("Token image URL or data URI (optional):", "") || "";
      const payload = JSON.stringify({
        sourceType: "custom",
        sourceId: "",
        name,
        tokenImage,
      });
      if (event.dataTransfer) {
        event.dataTransfer.setData("application/x-tabletop-placement", payload);
        event.dataTransfer.setData("text/plain", payload);
        event.dataTransfer.effectAllowed = "copy";
      }
    });
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

  const HIDDEN_SELF_MODIFIERS = new Set(["bottled_luck"]);

  const MAJOR_SKILL_ORDER = [
    "melee weapons",
    "ranged weapons",
    "dodge",
    "health pool",
    "mana pool",
    "resist condition",
    "resist damage",
    "resistive willpower",
    "evoke runes",
    "initiative",
    "beseech the gods",
  ];

  const MINOR_SKILL_ORDER = [
    "strength",
    "athletics",
    "stealth",
    "endurance",
    "resist pain",
    "assertive willpower",
    "problem solving",
    "craft magic item",
    "knowledge (lore)",
    "knowledge (magic)",
    "knowledge (biology)",
    "perception",
    "charisma",
    "perform",
    "sense motive",
    "deception",
    "interact with nature",
  ];

  const SKILL_MENU_ORDER = [...MAJOR_SKILL_ORDER, ...MINOR_SKILL_ORDER];
  const MAJOR_SKILL_SET = new Set(MAJOR_SKILL_ORDER);
  const MINOR_SKILL_SET = new Set(MINOR_SKILL_ORDER);
  const ATTACK_SKILLS = new Set(["melee weapons", "ranged weapons"]);

  function skillDisplayName(skillName) {
    return String(skillName || "")
      .split(" ")
      .filter(Boolean)
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(" ");
  }

  function deriveRollTypeFromSkill(skillName, rollTypeHint = "") {
    const hint = normalizeLabel(rollTypeHint);
    if (hint) {
      return hint;
    }
    const normalized = normalizeLabel(skillName);
    if (!normalized) {
      return "major_skill";
    }
    if (normalized === "prepared prayer") {
      return "prepared_prayer";
    }
    if (normalized === "beseech the gods") {
      return "beseech_the_gods";
    }
    if (normalized === "resistive willpower") {
      return "resistive_willpower";
    }
    if (ATTACK_SKILLS.has(normalized)) {
      return "attack";
    }
    if (MINOR_SKILL_SET.has(normalized)) {
      return "minor_skill";
    }
    if (MAJOR_SKILL_SET.has(normalized)) {
      return "major_skill";
    }
    return "major_skill";
  }

  function rollContextLabel(rollType) {
    const labels = {
      major_skill: "Major Skill",
      minor_skill: "Minor Skill",
      attack: "Attack",
      saving_throw: "Saving Throw",
      beseech_the_gods: "Beseech the Gods",
      prepared_prayer: "Prepared Prayer",
      constitution_check: "Constitution Check",
      resistive_willpower: "Resistive Willpower",
    };
    return labels[rollType] || rollType;
  }

  function rollContextValue() {
    return normalizeLabel(
      elements.rollTypeDisplay && elements.rollTypeDisplay.dataset
        ? elements.rollTypeDisplay.dataset.value
        : elements.rollTypeDisplay.textContent
    ) || "major_skill";
  }

  function setRollContext(rollType) {
    const normalized = normalizeLabel(rollType) || "major_skill";
    if (elements.rollTypeDisplay && elements.rollTypeDisplay.dataset) {
      elements.rollTypeDisplay.dataset.value = normalized;
    }
    elements.rollTypeDisplay.textContent = rollContextLabel(normalized);
  }

  function normalizedSkillValue() {
    return normalizeLabel(elements.rollSkillSelect ? elements.rollSkillSelect.value : "");
  }

  function getEntitySkillEntries(entity) {
    const parsed = (entity && entity.parsedSheet) || {};
    const skills = parsed.skills && typeof parsed.skills === "object" ? parsed.skills : {};
    const normalizedSkills = new Map();
    Object.keys(skills).forEach((rawKey) => {
      normalizedSkills.set(normalizeLabel(rawKey), Number(skills[rawKey]));
    });

    const hasParsedSkills = normalizedSkills.size > 0;
    const entries = [];
    SKILL_MENU_ORDER.forEach((skillName) => {
      if (hasParsedSkills && !normalizedSkills.has(skillName)) {
        return;
      }
      const rawBonus = normalizedSkills.has(skillName) ? normalizedSkills.get(skillName) : 0;
      const bonus = Number.isFinite(rawBonus) ? rawBonus : 0;
      entries.push({
        value: skillName,
        label: skillDisplayName(skillName),
        bonus,
      });
    });
    return entries;
  }

  function getSkillBonusForEntity(entity, skillName) {
    const normalized = normalizeLabel(skillName);
    if (!entity || !normalized) {
      return 0;
    }
    const parsed = entity.parsedSheet || {};
    const skills = parsed.skills && typeof parsed.skills === "object" ? parsed.skills : {};
    const exactKey = Object.keys(skills).find((key) => normalizeLabel(key) === normalized);
    if (!exactKey) {
      return 0;
    }
    const bonus = Number(skills[exactKey]);
    return Number.isFinite(bonus) ? bonus : 0;
  }

  function syncRollSkillContext(rollTypeHint = "") {
    const parsed = parseEntitySelectValue(elements.rollEntitySelect.value);
    const entity = parsed ? parsed.entity : null;
    const skillName = elements.rollSkillSelect.value;
    const rollType = deriveRollTypeFromSkill(skillName, rollTypeHint);
    setRollContext(rollType);

    const selectedKey = `${parsed ? `${parsed.type}:${parsed.id}` : "none"}:${normalizeLabel(skillName)}`;
    if (state.lastRollSkillKey !== selectedKey) {
      elements.rollSkillModifier.value = String(getSkillBonusForEntity(entity, skillName));
      state.lastRollSkillKey = selectedKey;
    }
  }

  function renderRollSkillOptions(preferredSkillName = "", preferredRollType = "") {
    const parsed = parseEntitySelectValue(elements.rollEntitySelect.value);
    const entity = parsed ? parsed.entity : null;
    const currentValue = normalizeLabel(elements.rollSkillSelect.value);
    const desiredValue = normalizeLabel(preferredSkillName);
    const skills = getEntitySkillEntries(entity);

    elements.rollSkillSelect.innerHTML = "";
    const majorGroup = document.createElement("optgroup");
    majorGroup.label = "Major Skills";
    const minorGroup = document.createElement("optgroup");
    minorGroup.label = "Minor Skills";

    skills.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.value;
      option.textContent = entry.label;
      if (MINOR_SKILL_SET.has(entry.value)) {
        minorGroup.appendChild(option);
      } else {
        majorGroup.appendChild(option);
      }
    });

    if (majorGroup.children.length > 0) {
      elements.rollSkillSelect.appendChild(majorGroup);
    }
    if (minorGroup.children.length > 0) {
      elements.rollSkillSelect.appendChild(minorGroup);
    }

    if (desiredValue && skills.some((entry) => entry.value === desiredValue)) {
      elements.rollSkillSelect.value = desiredValue;
    } else if (currentValue && skills.some((entry) => entry.value === currentValue)) {
      elements.rollSkillSelect.value = currentValue;
    } else if (skills.length > 0) {
      elements.rollSkillSelect.value = skills[0].value;
    }

    if (desiredValue && !skills.some((entry) => entry.value === desiredValue)) {
      const option = document.createElement("option");
      option.value = desiredValue;
      option.textContent = skillDisplayName(desiredValue);
      elements.rollSkillSelect.appendChild(option);
      elements.rollSkillSelect.value = desiredValue;
    }

    syncRollSkillContext(preferredRollType);
  }

  function deriveModifiersFromEntity(entity) {
    if (!entity) {
      return [];
    }

    const catalog = mapOfModifierCatalog();
    const feats = new Set(
      ((entity.parsedSheet && entity.parsedSheet.feats) || []).map((featName) => normalizeLabel(featName))
    );
    const resolved = [];
    Object.values(catalog).forEach((modifier) => {
      if ((modifier.featNames || []).some((featName) => feats.has(normalizeLabel(featName)))) {
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

    const preferredCharacter = state.selectedCharacterId
      ? `character:${state.selectedCharacterId}`
      : "";
    if (preferredCharacter && options.some((entry) => entry.value === preferredCharacter)) {
      elements.rollEntitySelect.value = preferredCharacter;
    } else if (options.some((entry) => entry.value === currentValue)) {
      elements.rollEntitySelect.value = currentValue;
    } else if (options.length > 0) {
      elements.rollEntitySelect.value = options[0].value;
    }
    renderRollSkillOptions();
    renderRollModifiers();
  }

  function renderRollModifiers() {
    const parsed = parseEntitySelectValue(elements.rollEntitySelect.value);
    const entity = parsed ? parsed.entity : null;
    const rollType = rollContextValue();
    const skillName = normalizedSkillValue();
    const selfModifiers = deriveModifiersFromEntity(entity);
    const catalog = mapOfModifierCatalog();

    const keepChecked = new Set();
    const visibleModifierIds = new Set();

    elements.rollModifierList.innerHTML = "";
    selfModifiers.forEach((modifierId) => {
      if (HIDDEN_SELF_MODIFIERS.has(modifierId)) {
        return;
      }
      const meta = catalog[modifierId];
      if (!doesModifierApply(meta, rollType, skillName)) {
        return;
      }
      visibleModifierIds.add(modifierId);
      const row = document.createElement("label");
      row.className = "tt-list-item";

      const left = document.createElement("span");
      const featLabel =
        meta && Array.isArray(meta.featNames) && meta.featNames[0] ? meta.featNames[0] : modifierId;
      left.textContent = meta ? `${featLabel} (${meta.phase})` : modifierId;
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
        updateConditionalRollControls(visibleModifierIds);
      });
      row.appendChild(checkbox);

      elements.rollModifierList.appendChild(row);
    });

    state.checkedSelfModifiers = keepChecked;

    elements.approvedModifierList.innerHTML = "";
    const keepApproved = new Set();
    state.approvedModifierEntries.forEach((entry) => {
      const meta = catalog[entry.modifierId];
      if (!doesModifierApply(meta, rollType, skillName)) {
        return;
      }
      visibleModifierIds.add(entry.modifierId);
      const row = document.createElement("label");
      row.className = "tt-list-item";
      const text = document.createElement("span");
      const featLabel =
        meta && Array.isArray(meta.featNames) && meta.featNames[0]
          ? meta.featNames[0]
          : entry.modifierId;
      text.textContent = `${featLabel} (approved by ${entry.byUsername})`;
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
        updateConditionalRollControls(visibleModifierIds);
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

    updateConditionalRollControls(visibleModifierIds);
    renderAllyModifierSelectors();
  }

  function updateConditionalRollControls(visibleModifierIds) {
    const visible = visibleModifierIds instanceof Set ? visibleModifierIds : new Set();
    const selectedModifierIds = new Set();

    state.checkedSelfModifiers.forEach((modifierId) => {
      if (visible.has(modifierId)) {
        selectedModifierIds.add(modifierId);
      }
    });
    state.approvedModifierEntries.forEach((entry) => {
      if (!entry || !state.checkedApprovedModifierIds.has(entry.approvalId)) {
        return;
      }
      if (visible.has(entry.modifierId)) {
        selectedModifierIds.add(entry.modifierId);
      }
    });

    const showMiracleSettings = selectedModifierIds.has("miracle_worker");
    const showShiftingSettings = selectedModifierIds.has("shifting_fortunes");
    const needsTargetDie =
      selectedModifierIds.has("inspired_by_the_gods") || selectedModifierIds.has("small_fortunes");

    if (elements.rollMiracleWrap) {
      elements.rollMiracleWrap.classList.toggle("tt-hidden", !showMiracleSettings);
    }
    if (!showMiracleSettings && elements.rollUseMiracle) {
      elements.rollUseMiracle.checked = false;
    }

    if (elements.rollShiftingWrap) {
      elements.rollShiftingWrap.classList.toggle("tt-hidden", !showShiftingSettings);
    }
    if (!showShiftingSettings && elements.rollShiftingMode) {
      elements.rollShiftingMode.value = "add";
    }

    if (elements.rollTargetDieWrap) {
      elements.rollTargetDieWrap.classList.toggle("tt-hidden", !needsTargetDie);
    }
    if (!needsTargetDie && elements.rollTargetDieIndex) {
      elements.rollTargetDieIndex.value = "0";
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

    elements.injuryCard.classList.toggle("tt-hidden", !isAuthenticated());
    elements.injuryRoll.disabled = entries.length === 0;
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
        const rollData = entry.details.roll;
        const groups = Array.isArray(rollData.d20.groups) ? rollData.d20.groups : [];
        const groupText = groups.length > 1
          ? `groups: ${groups
            .map((group, index) => `#${index + 1}[${group.dice.join(",")}]=>${group.selected}`)
            .join(" | ")}`
          : `d20s: ${rollData.d20.dice.join(", ")}`;
        rollLine.textContent = `${groupText} | selected ${rollData.d20.selected} | total ${rollData.total}`;
        block.appendChild(rollLine);

        if (rollData.isdcCheck && rollData.isdcCheck.required) {
          const isdcLine = document.createElement("div");
          isdcLine.className = "tt-log-meta";
          isdcLine.textContent =
            `ISDC check: ${rollData.isdcCheck.total}/${rollData.isdcCheck.dc} (${rollData.isdcCheck.passed ? "pass" : "fail"})`;
          block.appendChild(isdcLine);
        }
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
    applyMenuVisibility();
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
      if (HIDDEN_SELF_MODIFIERS.has(modifierId)) {
        return;
      }
      const entry = { id: modifierId, external: false };
      if (modifierId === "portent") {
        const typed = window.prompt("Portent die value (1-20):", "10");
        const value = Number.parseInt(typed || "", 10);
        if (!Number.isFinite(value) || value < 1 || value > 20) {
          setStatus("Portent requires a value from 1 to 20.", true);
          return;
        }
        entry.portentValue = value;
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

  if (elements.menuToggle) {
    elements.menuToggle.addEventListener("click", () => {
      elements.menuButtons.classList.toggle("tt-hidden");
    });
  }

  if (elements.menuAccount) {
    elements.menuAccount.addEventListener("click", () => setActiveMenu("account"));
  }
  if (elements.menuCharacter) {
    elements.menuCharacter.addEventListener("click", () => setActiveMenu("character"));
  }
  if (elements.menuRolls) {
    elements.menuRolls.addEventListener("click", () => setActiveMenu("rolls"));
  }
  if (elements.menuLog) {
    elements.menuLog.addEventListener("click", () => setActiveMenu("log"));
  }
  if (elements.menuUtilities) {
    elements.menuUtilities.addEventListener("click", () => setActiveMenu("utilities"));
  }

  if (elements.characterSelect) {
    elements.characterSelect.addEventListener("change", () => {
      const selectedId = elements.characterSelect.value;
      if (!selectedId) {
        state.selectedCharacterId = null;
        resetCharacterForm();
        return;
      }
      selectCharacterById(selectedId, isDm() ? characters() : ownCharacters(), true);
    });
  }

  if (elements.characterNewButton) {
    elements.characterNewButton.addEventListener("click", () => {
      state.selectedCharacterId = null;
      state.pendingCharacterSelection = null;
      if (elements.characterSelect) {
        elements.characterSelect.value = "";
      }
      resetCharacterForm();
    });
  }

  if (elements.characterRefreshButton) {
    elements.characterRefreshButton.addEventListener("click", () => {
      const characterId = elements.characterId.value || state.selectedCharacterId || "";
      if (!characterId) {
        setStatus("Select a saved character first.", true);
        return;
      }
      emit("character:refresh", { id: characterId });
      setStatus("Refreshing character sheet...");
    });
  }

  if (elements.characterTokenFile) {
    elements.characterTokenFile.addEventListener("change", async () => {
      const file = elements.characterTokenFile.files && elements.characterTokenFile.files[0];
      if (!file) {
        return;
      }
      try {
        const imageDataUrl = await readFileAsDataUrl(file);
        elements.characterTokenImage.value = imageDataUrl;
        setStatus(`Loaded token file: ${file.name}`);
      } catch (error) {
        setStatus(error.message, true);
      }
    });
  }

  elements.characterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.pendingCharacterSelection = {
      id: elements.characterId.value || null,
      name: normalizeLabel(elements.characterName.value),
      ownerUserId: userId(),
      submittedAt: Date.now(),
    };
    state.selectedCharacterId = elements.characterId.value || state.selectedCharacterId || null;
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
    state.checkedSelfModifiers.clear();
    state.checkedApprovedModifierIds.clear();
    state.approvedModifierEntries = [];
    state.lastRollSkillKey = null;
    renderRollSkillOptions();
    renderRollModifiers();
  });

  elements.rollSkillSelect.addEventListener("change", () => {
    state.lastRollSkillKey = null;
    syncRollSkillContext();
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
        skillName: elements.rollSkillSelect.value,
        rollType: rollContextValue(),
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
    if (!elements.rollSkillSelect.value) {
      setStatus("Select a skill to roll.", true);
      return;
    }

    const payload = {
      ...entityPayload,
      skillName: elements.rollSkillSelect.value,
      rollType: rollContextValue(),
      advantageLevel: Number.parseInt(elements.rollAdvantage.value, 10) || 0,
      flatModifier: Number.parseInt(elements.rollBonusOverride.value, 10) || 0,
      bonusOverride: Number.parseInt(elements.rollSkillModifier.value, 10) || 0,
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
      rollType: deriveRollTypeFromSkill(skillName),
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
    const message = payload && payload.message ? payload.message : "Unknown error";
    setStatus(message, true);
    if (/uses remaining/i.test(message)) {
      window.alert(message);
    }
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
    const groups = roll.d20 && Array.isArray(roll.d20.groups) ? roll.d20.groups : [];
    const diceText = groups.length > 1
      ? groups
        .map((group, index) => `#${index + 1}[${group.dice.join(",")}]=>${group.selected}`)
        .join(" | ")
      : roll.d20 && Array.isArray(roll.d20.dice)
        ? roll.d20.dice.join(", ")
        : "-";
    const guidanceText = Array.isArray(roll.guidingDice) && roll.guidingDice.length > 0
      ? ` | extra: ${roll.guidingDice.map((entry) => `${entry.type}:${entry.roll}`).join(", ")}`
      : "";
    const fofText =
      roll.fortuneOverFinesse && roll.fortuneOverFinesse.enabled
        ? ` | FoF groups: +${roll.fortuneOverFinesse.extraGroups}`
        : "";
    const isdcText =
      roll.isdcCheck && roll.isdcCheck.required
        ? ` | ISDC ${roll.isdcCheck.passed ? "pass" : "fail"} (${roll.isdcCheck.total}/${roll.isdcCheck.dc})`
        : "";
    elements.rollResult.textContent =
      `${payload.entityName}: ${roll.total} | d20: ${diceText}${fofText}${guidanceText}${isdcText}`;
  });

  socket.on("roll:groupRequested", (payload) => {
    setStatus(`${payload.requestedBy} requested: ${payload.skillName}`, false);

    if (Array.isArray(payload.characterOptions) && payload.characterOptions.length > 0) {
      const first = payload.characterOptions[0];
      const wantedValue = `character:${first.id}`;
      if (Array.from(elements.rollEntitySelect.options).some((option) => option.value === wantedValue)) {
        elements.rollEntitySelect.value = wantedValue;
      }
    }
    state.lastRollSkillKey = null;
    renderRollSkillOptions(payload.skillName, payload.rollType);
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
