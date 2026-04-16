import { loadJsonFile, downloadJson } from "./io.js";
import { renderApp } from "./render.js";
import {
  createInitialState,
  startNewPuzzle,
  setPuzzleSize,
  resetApp,
  setSelectedCell,
  setActiveRegion,
  paintRegion,
  clearRegion,
  clearAllRegions,
  finalizeJigsawRegions,
  editJigsawRegions,
  setGivenValue,
  clearGivenValue,
  beginSolving,
  setEntryValue,
  clearEntryValue,
  undo,
  redo,
  hydrateImportedState,
  createDesignExport,
  createProgressExport,
  isSolved,
  setAnalysisOption,
  toggleSolveOptions,
  closeSolveOptions,
} from "./state.js";

const root = document.getElementById("app");
const state = createInitialState();

render();

root.addEventListener("click", async (event) => {
  const insideOptions = event.target.closest(".options-popover");
  const toggleOptionsButton = event.target.closest('[data-action="toggle-options"]');

  if (
    state.ui.solveOptionsOpen &&
    !insideOptions &&
    !toggleOptionsButton
  ) {
    closeSolveOptions(state);
    render();
    return;
  }

  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) {
    return;
  }

  const action = actionElement.dataset.action;
  const index = actionElement.dataset.index === undefined ? null : Number(actionElement.dataset.index);
  const digit = actionElement.dataset.digit === undefined ? null : Number(actionElement.dataset.digit);
  const region = actionElement.dataset.region === undefined ? null : Number(actionElement.dataset.region);

  switch (action) {
    case "start-classic":
      startNewPuzzle(state, "classic", state.size);
      break;
    case "start-jigsaw":
      startNewPuzzle(state, "jigsaw", state.size);
      break;
    case "go-home":
      resetApp(state);
      break;
    case "toggle-options":
      toggleSolveOptions(state);
      break;
    case "close-options":
      closeSolveOptions(state);
      break;
    case "select-cell":
      if (state.stage === "design-regions") {
        setSelectedCell(state, index);
        paintRegion(state, index);
      } else {
        setSelectedCell(state, index);
      }
      break;
    case "select-region":
      setActiveRegion(state, region);
      break;
    case "clear-selected-region":
      if (state.selectedCell !== null) {
        clearRegion(state, state.selectedCell);
      }
      break;
    case "clear-all-regions":
      clearAllRegions(state);
      break;
    case "continue-jigsaw":
      finalizeJigsawRegions(state);
      break;
    case "edit-regions":
      editJigsawRegions(state);
      break;
    case "set-digit":
      if (state.selectedCell !== null) {
        setGivenValue(state, state.selectedCell, digit);
      }
      break;
    case "play-digit":
    case "candidate-pick":
      if (state.selectedCell !== null) {
        setEntryValue(state, state.selectedCell, digit);
      }
      break;
    case "clear-selected-value":
      if (state.selectedCell !== null) {
        if (state.stage === "solve") {
          clearEntryValue(state, state.selectedCell);
        } else if (state.stage === "design-givens") {
          clearGivenValue(state, state.selectedCell);
        }
      }
      break;
    case "start-solving":
      beginSolving(state);
      break;
    case "export-design":
      downloadJson(createFilename(state, "design"), createDesignExport(state));
      state.message = "Design exported as JSON.";
      break;
    case "export-progress":
      downloadJson(createFilename(state, "progress"), createProgressExport(state));
      state.message = "Progress exported as JSON.";
      break;
    case "trigger-import":
      getFileInput().click();
      break;
    case "undo":
      undo(state);
      break;
    case "redo":
      redo(state);
      break;
    default:
      break;
  }

  if (isSolved(state)) {
    state.message = "Board solved without conflicts.";
  }

  render();
});

root.addEventListener("change", (event) => {
  const target = event.target;
  if (target instanceof HTMLSelectElement && target.id === "start-size") {
    setPuzzleSize(state, Number(target.value));
    render();
    return;
  }

  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.dataset.setting === "enable-claiming") {
    setAnalysisOption(state, "enableClaiming", target.checked);
    render();
    return;
  }

  if (target.dataset.setting === "show-all-candidates") {
    setAnalysisOption(state, "showAllCandidates", target.checked);
    render();
  }
});

document.addEventListener("keydown", (event) => {
  const activeTag = document.activeElement?.tagName;
  if (activeTag === "INPUT" || activeTag === "SELECT" || activeTag === "TEXTAREA") {
    return;
  }

  if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo(state);
    render();
    return;
  }

  if ((event.ctrlKey && event.key.toLowerCase() === "y") || (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "z")) {
    event.preventDefault();
    redo(state);
    render();
    return;
  }

  if (event.key === "Escape") {
    if (state.ui.solveOptionsOpen) {
      closeSolveOptions(state);
      render();
      return;
    }

    setSelectedCell(state, null);
    render();
    return;
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    if (state.selectedCell !== null) {
      if (state.stage === "solve") {
        clearEntryValue(state, state.selectedCell);
      } else if (state.stage === "design-givens") {
        clearGivenValue(state, state.selectedCell);
      } else if (state.stage === "design-regions") {
        clearRegion(state, state.selectedCell);
      }
      render();
    }
    return;
  }

  const digit = Number(event.key);
  if (!Number.isInteger(digit) || digit < 1 || digit > state.size || state.selectedCell === null) {
    return;
  }

  if (state.stage === "design-givens") {
    setGivenValue(state, state.selectedCell, digit);
  } else if (state.stage === "solve") {
    setEntryValue(state, state.selectedCell, digit);
  }

  render();
});

function render() {
  renderApp(root, state);
  bindFileInput();
}

function bindFileInput() {
  const fileInput = getFileInput();
  fileInput.onchange = async () => {
    const [file] = fileInput.files;
    if (!file) {
      return;
    }

    try {
      const payload = await loadJsonFile(file);
      hydrateImportedState(state, payload);
    } catch (error) {
      state.message = error instanceof Error ? error.message : "Import failed.";
    }

    fileInput.value = "";
    render();
  };
}

function getFileInput() {
  return document.getElementById("file-input");
}

function createFilename(state, type) {
  const variant = state.variant ?? "sudoku";
  return `${variant}-${state.size}x${state.size}-${type}.json`;
}