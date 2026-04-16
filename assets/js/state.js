import {
  DEFAULT_BOARD_SIZE,
  createClassicRegions,
  createEmptyRegions,
  createEmptyValues,
  getCellCount,
  getCurrentValues,
  getRegionLabels,
  isClassicSizeSupported,
  isSupportedSize,
  validateJigsawRegions,
  boardHasConflicts,
  canPlaceDigit,
} from "./rules.js";

export function createInitialState() {
  return {
    variant: null,
    size: DEFAULT_BOARD_SIZE,
    stage: "start",
    givens: createEmptyValues(DEFAULT_BOARD_SIZE),
    entries: createEmptyValues(DEFAULT_BOARD_SIZE),
    regions: createEmptyRegions(DEFAULT_BOARD_SIZE),
    selectedCell: null,
    activeRegion: 0,
    ui: createDefaultUiState(),
    analysisOptions: createDefaultAnalysisOptions(),
    history: [],
    historyCursor: -1,
    message: "Choose a board size, then start a classic or jigsaw puzzle, or load a JSON file.",
  };
}

export function setPuzzleSize(state, size) {
  if (!isSupportedSize(size)) {
    return false;
  }

  state.size = size;
  state.selectedCell = null;
  state.activeRegion = 0;
  state.message = isClassicSizeSupported(size)
    ? `${size}x${size} selected. Classic and jigsaw are both available.`
    : `${size}x${size} selected. Use jigsaw for this size; classic remains available for 4x4, 6x6, 8x8, and 9x9.`;
  return true;
}

export function startNewPuzzle(state, variant, size = state.size) {
  if (!isSupportedSize(size)) {
    state.message = "That board size is not supported.";
    return false;
  }

  if (variant === "classic" && !isClassicSizeSupported(size)) {
    state.message = `Classic mode is currently available for 4x4, 6x6, 8x8, and 9x9. ${size}x${size} can still be created as jigsaw.`;
    return false;
  }

  const regions = variant === "classic" ? createClassicRegions(size) : createEmptyRegions(size);
  const labels = getRegionLabels(size);

  resetToState(state, {
    variant,
    size,
    stage: variant === "classic" ? "design-givens" : "design-regions",
    givens: createEmptyValues(size),
    entries: createEmptyValues(size),
    regions,
    selectedCell: null,
    activeRegion: 0,
    ui: createDefaultUiState(),
    analysisOptions: createDefaultAnalysisOptions(),
    history: [],
    historyCursor: -1,
    message:
      variant === "classic"
        ? `Classic ${size}x${size} ready. Enter the starting digits and export the design when it is stable.`
        : `Paint ${size} connected regions. Each region ${labels.join(", ")} must occupy exactly ${size} orthogonally connected cells.`,
  });

  return true;
}

export function resetApp(state) {
  resetToState(state, createInitialState());
}

export function setSelectedCell(state, index) {
  if (index === null || index < 0 || index >= getCellCount(state.size)) {
    state.selectedCell = null;
    return;
  }

  if (state.stage === "solve" && state.givens[index]) {
    state.selectedCell = null;
    state.message = "Given cells are locked in solving mode.";
    return;
  }

  state.selectedCell = index;
}

export function setActiveRegion(state, region) {
  if (region < 0 || region >= state.size) {
    return;
  }

  state.activeRegion = region;
  state.message = `Painting region ${getRegionLabels(state.size)[region]}.`;
}

export function paintRegion(state, index) {
  if (state.stage !== "design-regions") {
    return;
  }

  const before = state.regions[index];
  const after = state.activeRegion;

  if (before === after) {
    return;
  }

  state.regions[index] = after;
  pushHistory(state, { type: "paint-region", index, before, after });
}

export function clearRegion(state, index) {
  if (state.stage !== "design-regions") {
    return;
  }

  const before = state.regions[index];
  if (before === null) {
    return;
  }

  state.regions[index] = null;
  pushHistory(state, { type: "paint-region", index, before, after: null });
}

export function clearAllRegions(state) {
  if (state.stage !== "design-regions") {
    return;
  }

  const before = [...state.regions];
  state.regions = createEmptyRegions(state.size);
  pushHistory(state, { type: "bulk-regions", before, after: [...state.regions] });
  state.message = "All jigsaw regions were cleared.";
}

export function finalizeJigsawRegions(state) {
  const validation = validateJigsawRegions(state.regions, state.size);

  if (!validation.valid) {
    state.message = validation.problems[0] ?? "Fix the region layout before entering givens.";
    return false;
  }

  state.stage = "design-givens";
  state.message = "Jigsaw regions accepted. Enter the starting digits next.";
  return true;
}

export function editJigsawRegions(state) {
  if (state.variant !== "jigsaw") {
    return;
  }

  state.stage = "design-regions";
  state.selectedCell = null;
  state.message = "Region painting re-opened. Givens are preserved while you adjust the map.";
}

export function setGivenValue(state, index, value) {
  if (state.stage !== "design-givens") {
    return;
  }

  const before = state.givens[index];
  const after = value;
  if (before === after) {
    return;
  }

  state.givens[index] = after;
  if (after) {
    state.entries[index] = 0;
  }

  pushHistory(state, { type: "set-given", index, before, after });
}

export function clearGivenValue(state, index) {
  setGivenValue(state, index, 0);
}

export function beginSolving(state) {
  const validation = validateDesign(state);
  if (!validation.valid) {
    state.message = validation.message;
    return false;
  }

  state.entries = createEmptyValues(state.size);
  state.selectedCell = null;
  state.ui.solveOptionsOpen = false;
  state.stage = "solve";
  state.history = [];
  state.historyCursor = -1;
  state.message = "Solving mode ready. Select an empty cell to inspect its candidates.";
  return true;
}

export function setEntryValue(state, index, value) {
  if (state.stage !== "solve" || state.givens[index]) {
    return false;
  }

  if (value !== 0 && !canPlaceDigit(state.givens, state.entries, state.regions, index, value, state.size, state.analysisOptions)) {
    state.message = `Digit ${value} is not allowed in that cell.`;
    return false;
  }

  const before = state.entries[index];
  const after = value;
  if (before === after) {
    return true;
  }

  state.entries[index] = after;
  pushHistory(state, { type: "set-entry", index, before, after });
  state.message = after ? `Placed ${after}.` : "Cell cleared.";
  return true;
}

export function clearEntryValue(state, index) {
  return setEntryValue(state, index, 0);
}

export function undo(state) {
  if (state.historyCursor < 0) {
    state.message = "Nothing left to undo.";
    return false;
  }

  const action = state.history[state.historyCursor];
  applyAction(state, action, "undo");
  state.historyCursor -= 1;
  state.message = "Last change reverted.";
  return true;
}

export function redo(state) {
  if (state.historyCursor >= state.history.length - 1) {
    state.message = "Nothing left to redo.";
    return false;
  }

  state.historyCursor += 1;
  const action = state.history[state.historyCursor];
  applyAction(state, action, "redo");
  state.message = "Change restored.";
  return true;
}

export function validateDesign(state) {
  if (state.variant === "jigsaw") {
    const regionValidation = validateJigsawRegions(state.regions, state.size);
    if (!regionValidation.valid) {
      return { valid: false, message: "Jigsaw regions are incomplete or invalid." };
    }
  }

  if (boardHasConflicts(state.givens, createEmptyValues(state.size), state.regions, state.size)) {
    return { valid: false, message: "The givens contain row, column, or region conflicts." };
  }

  return { valid: true, message: "Design is valid." };
}

export function isSolved(state) {
  const values = getCurrentValues(state.givens, state.entries);

  return (
    state.stage === "solve" &&
    values.every((value) => value > 0) &&
    !boardHasConflicts(state.givens, state.entries, state.regions, state.size)
  );
}

export function hydrateImportedState(state, payload) {
  const size = payload.size;
  if (!isSupportedSize(size)) {
    throw new Error(`Board size ${size} is not supported.`);
  }

  if (payload.variant === "classic" && !isClassicSizeSupported(size)) {
    throw new Error(`Classic ${size}x${size} is not supported in this build.`);
  }

  const regions = payload.variant === "classic" ? createClassicRegions(size) : [...payload.regions];

  if (payload.saveType === "progress") {
    const overlappingEntries = payload.entries.some((entry, index) => entry > 0 && payload.givens[index] > 0);
    if (overlappingEntries) {
      throw new Error("Progress files cannot place editable entries on top of given cells.");
    }
  }

  const importedState = {
    variant: payload.variant,
    size,
    stage: payload.saveType === "progress" ? "solve" : "design-givens",
    givens: [...payload.givens],
    entries: payload.saveType === "progress" ? [...payload.entries] : createEmptyValues(size),
    regions,
    selectedCell: null,
    activeRegion: 0,
    ui: createDefaultUiState(),
    analysisOptions: normalizeAnalysisOptions(payload.analysisOptions),
    history: payload.saveType === "progress" ? payload.history.map(cloneHistoryAction) : [],
    historyCursor: payload.saveType === "progress" ? payload.historyCursor : -1,
    message:
      payload.saveType === "progress"
        ? "Progress file loaded. You can continue solving from the saved state."
        : "Design file loaded. Continue editing or move into solving mode.",
  };

  if (payload.variant === "jigsaw") {
    const validation = validateJigsawRegions(importedState.regions, size);
    if (!validation.valid) {
      throw new Error("The imported jigsaw region map is invalid.");
    }
  }

  if (boardHasConflicts(importedState.givens, createEmptyValues(size), importedState.regions, size)) {
    throw new Error("The imported givens contain conflicts.");
  }

  if (payload.saveType === "progress" && boardHasConflicts(importedState.givens, importedState.entries, importedState.regions, size)) {
    throw new Error("The imported progress contains conflicts.");
  }

  resetToState(state, importedState);
}

export function createDesignExport(state) {
  return {
    version: 1,
    saveType: "design",
    variant: state.variant,
    size: state.size,
    givens: [...state.givens],
    regions: [...state.regions],
    analysisOptions: { ...state.analysisOptions },
  };
}

export function createProgressExport(state) {
  return {
    version: 1,
    saveType: "progress",
    variant: state.variant,
    size: state.size,
    givens: [...state.givens],
    entries: [...state.entries],
    regions: [...state.regions],
    analysisOptions: { ...state.analysisOptions },
    history: state.history.map(cloneHistoryAction),
    historyCursor: state.historyCursor,
  };
}

export function setAnalysisOption(state, option, value) {
  if (!(option in state.analysisOptions)) {
    return;
  }

  state.analysisOptions[option] = Boolean(value);
  state.message = getAnalysisOptionMessage(option, state.analysisOptions[option]);
}

export function toggleSolveOptions(state) {
  state.ui.solveOptionsOpen = !state.ui.solveOptionsOpen;
}

export function closeSolveOptions(state) {
  state.ui.solveOptionsOpen = false;
}

function pushHistory(state, action) {
  state.history = state.history.slice(0, state.historyCursor + 1);
  state.history.push(action);

  if (state.history.length > 500) {
    state.history.shift();
  }

  state.historyCursor = state.history.length - 1;
}

function applyAction(state, action, direction) {
  const source = direction === "undo" ? action.before : action.after;

  switch (action.type) {
    case "paint-region":
      state.regions[action.index] = source;
      break;
    case "bulk-regions":
      state.regions = [...source];
      break;
    case "set-given":
      state.givens[action.index] = source;
      if (source) {
        state.entries[action.index] = 0;
      }
      break;
    case "set-entry":
      state.entries[action.index] = source;
      break;
    default:
      throw new Error(`Unsupported history action: ${action.type}`);
  }
}

function resetToState(state, nextState) {
  Object.keys(state).forEach((key) => {
    delete state[key];
  });

  Object.assign(state, nextState);
}

function createDefaultAnalysisOptions() {
  return {
    enableClaiming: false,
    showAllCandidates: false,
  };
}

function createDefaultUiState() {
  return {
    solveOptionsOpen: false,
  };
}

function normalizeAnalysisOptions(value) {
  return {
    ...createDefaultAnalysisOptions(),
    ...(value && typeof value === "object" ? value : {}),
  };
}

function getAnalysisOptionMessage(option, enabled) {
  if (option === "enableClaiming") {
    return enabled
      ? "Claiming rule enabled for candidate filtering."
      : "Claiming rule disabled. Only default and pointing deductions apply.";
  }

  if (option === "showAllCandidates") {
    return enabled
      ? "Quiet candidate display enabled for all unresolved cells."
      : "Quiet candidate display hidden for non-selected cells.";
  }

  return "Analysis option updated.";
}

function cloneHistoryAction(action) {
  switch (action.type) {
    case "paint-region":
    case "set-given":
    case "set-entry":
      return {
        type: action.type,
        index: action.index,
        before: action.before,
        after: action.after,
      };
    case "bulk-regions":
      return {
        type: action.type,
        before: [...action.before],
        after: [...action.after],
      };
    default:
      throw new Error(`Unsupported history action: ${action.type}`);
  }
}