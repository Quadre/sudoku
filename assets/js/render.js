import {
  getCandidateGridDimensions,
  getCellCount,
  getControlGridColumns,
  getCurrentValues,
  getDigits,
  getRegionColor,
  getRegionEdgeStyle,
  getRegionLabels,
  getSupportedSizes,
  getCandidateMap,
  isClassicSizeSupported,
  toRowColumn,
  validateJigsawRegions,
  findConflicts,
} from "./rules.js";
import { isSolved, validateDesign } from "./state.js";

export function renderApp(root, state) {
  const content = state.stage === "start" ? renderStart(state) : renderWorkspace(state);
  root.innerHTML = `${content}<input id="file-input" class="hidden" type="file" accept="application/json">`;
}

function renderStart(state) {
  const supportedSizes = getSupportedSizes();
  const classicSupported = isClassicSizeSupported(state.size);
  const startNotice = renderStartNotice(state, classicSupported);

  return `
    <main class="shell">
      <section class="hero">
        <div>
          <h1>tbd</h1>
          <p>Build classic and jigsaw Sudoku boards from 3x3 through 9x9, save them as JSON text, reload unfinished progress, and solve directly in the browser with candidate guidance.</p>
        </div>
        <div class="hero-actions">
          <div class="hero-card stack">
            <h2>Start</h2>
            <label>
              Size
              <select id="start-size">
                ${supportedSizes.map((size) => `<option value="${size}" ${size === state.size ? "selected" : ""}>${size} x ${size}</option>`).join("")}
              </select>
            </label>
            <div class="button-row">
              <button class="primary" data-action="start-classic" ${classicSupported ? "" : "disabled"}>Create Classic</button>
              <button class="primary" data-action="start-jigsaw">Create Jigsaw</button>
            </div>
            <button class="secondary" data-action="trigger-import">Load JSON File</button>
            ${startNotice}
          </div>
        </div>
      </section>
    </main>
  `;
}

function renderWorkspace(state) {
  const values = getCurrentValues(state.givens, state.entries);
  const conflicts = findConflicts(values, state.regions, state.size);
  const designStatus = validateDesign(state);
  const regionStatus = state.variant === "jigsaw" ? validateJigsawRegions(state.regions, state.size) : null;
  const solved = isSolved(state);
  const candidateMap = state.stage === "solve" ? getCandidateMap(values, state.regions, state.size, state.analysisOptions) : null;
  const selectedCandidates = state.selectedCell === null || !candidateMap ? [] : candidateMap[state.selectedCell];
  const mobileBoardCardNumpad = renderBoardCardNumpad(state, selectedCandidates);
  const boardWrapClass = [
    "board-wrap",
    state.stage === "solve" && state.analysisOptions.allowCrossLine ? "board-wrap-helper-active" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const boardCardContent = state.stage.startsWith("design-")
    ? `
          <section class="status-card">
            ${renderStatusContent(state, designStatus, regionStatus, conflicts, solved)}
          </section>
          <div class="${boardWrapClass}">
            ${renderBoardArea(state, values, conflicts, candidateMap)}
          </div>
          ${mobileBoardCardNumpad}
          ${renderBoardToolbar(state)}
        `
    : `
          <div class="${boardWrapClass}">
            ${renderBoardArea(state, values, conflicts, candidateMap)}
          </div>
          ${mobileBoardCardNumpad}
          ${renderBoardToolbar(state)}
          <section class="status-card">
            ${renderStatusContent(state, designStatus, regionStatus, conflicts, solved)}
          </section>
        `;
  const workspaceClass = [
    "workspace",
    `workspace-${state.stage}`,
    state.stage === "solve" ? "workspace-solve" : "",
    state.stage.startsWith("design-") ? "workspace-design" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const boardCardClass = ["board-card", state.stage.startsWith("design-") ? "board-card-design" : ""]
    .filter(Boolean)
    .join(" ");

  return `
    <main class="shell">
      <section class="${workspaceClass}">
        <aside class="panel">
          ${renderControls(state, values, designStatus, regionStatus, solved, candidateMap)}
        </aside>
        <section class="${boardCardClass}">
          ${boardCardContent}
        </section>
      </section>
    </main>
  `;
}

function renderControls(state, values, designStatus, regionStatus, solved, candidateMap) {
  const selected = state.selectedCell === null ? null : toRowColumn(state.selectedCell, state.size);
  const regionLabels = getRegionLabels(state.size);
  const isDesignStage = state.stage === "design-regions" || state.stage === "design-givens";

  const meta = `
    <section class="stack control-section control-selection">
      <h2>Selection</h2>
      <div class="meta-list">
        <div class="meta-item"><span>Cell</span><strong>${selected ? `${selected.row + 1},${selected.column + 1}` : "-"}</strong></div>
        <div class="meta-item"><span>Value</span><strong>${state.selectedCell === null ? "-" : values[state.selectedCell] || "-"}</strong></div>
      </div>
    </section>
  `;

  if (state.stage === "design-regions") {
    return `
      <section class="stack control-section control-paint">
        <h2>Paint Regions</h2>
        <div class="palette" style="${getControlStyle(state.size)}">${regionLabels.map((label, index) => renderPaletteButton(index, label, state.activeRegion, state.size)).join("")}</div>
        <div class="button-row">
          <button class="secondary" data-action="clear-selected-region">Clear Selected Cell</button>
          <button class="secondary" data-action="clear-all-regions">Clear All Regions</button>
        </div>
      </section>
      <section class="stack control-section control-actions-final">
        <button class="primary" data-action="continue-jigsaw" ${regionStatus && !regionStatus.valid ? "disabled" : ""}>Continue To Givens</button>
        <button class="secondary" data-action="trigger-import">Load JSON File</button>
      </section>
    `;
  }

  if (state.stage === "design-givens") {
    return `
      ${renderNumpadSection({
        state,
        title: "Initial Digits",
        action: "set-digit",
        values: state.givens,
        stage: state.stage,
        wrapperClass: "numpad-panel",
      })}
      <section class="stack control-section control-actions-final">
        ${state.variant === "jigsaw" ? `<button class="ghost" data-action="edit-regions">Edit Regions</button>` : ""}
        <button class="primary" data-action="export-design" ${designStatus.valid ? "" : "disabled"}>Export Design</button>
        <button class="primary" data-action="start-solving" ${designStatus.valid ? "" : "disabled"}>Switch To Solving</button>
      </section>
    `;
  }

  const selectedCandidates = state.selectedCell === null || !candidateMap ? [] : candidateMap[state.selectedCell];

  return `
    ${isDesignStage ? "" : meta}
    ${renderNumpadSection({
      state,
      title: "Entry Pad",
      action: "play-digit",
      values: state.entries,
      stage: state.stage,
      selectedCandidates,
      wrapperClass: "numpad-panel",
      showImportButton: false,
    })}
    <section class="stack control-section control-actions-final">
      <button class="primary" data-action="export-progress">Export Progress</button>
      <button class="primary" data-action="trigger-import">Load JSON File</button>
    </section>
    <section class="stack control-section control-progress">
      <h2>Progress</h2>
      <div class="meta-list">
        <div class="meta-item"><span>Filled</span><strong>${values.filter(Boolean).length}/${getCellCount(state.size)}</strong></div>
        <div class="meta-item"><span>Status</span><strong>${solved ? "Solved" : "Active"}</strong></div>
        <div class="meta-item"><span>History</span><strong>${state.historyCursor + 1}/${state.history.length}</strong></div>
      </div>
    </section>
  `;
}

function renderBoard(state, values, conflicts, candidateMap) {
  return values
    .map((value, index) => renderCell(state, conflicts, index, value, candidateMap))
    .join("");
}

function renderBoardArea(state, values, conflicts, candidateMap) {
  const helperEnabled = state.stage === "solve" && state.analysisOptions.allowCrossLine;
  const boardMarkup = `
    <div class="board" data-size="${state.size}" style="${getBoardStyle(state)}">
      ${renderBoard(state, values, conflicts, candidateMap)}
      ${renderLineHelperOverlays(state)}
    </div>
  `;

  if (!helperEnabled) {
    return boardMarkup;
  }

  return `
    <div class="line-helper-shell" style="${getBoardStyle(state)}">
      <div class="line-helper-top">
        <div class="line-helper-corner" aria-hidden="true"></div>
        ${renderLineHelperColumnBar(state)}
      </div>
      <div class="line-helper-main">
        ${renderLineHelperRowBar(state)}
        ${boardMarkup}
      </div>
    </div>
  `;
}

function renderCell(state, conflicts, index, value, candidateMap) {
  const selected = state.selectedCell === index;
  const given = state.givens[index] > 0;
  const entry = !given && state.entries[index] > 0;
  const region = state.regions[index];
  const allowed = candidateMap?.[index] ?? [];
  const regionLabels = getRegionLabels(state.size);
  const suggestionsHidden = state.stage === "solve" && state.analysisOptions.hideSuggestions;
  const classes = [
    "cell",
    selected ? "selected" : "",
    given ? "given" : "",
    entry ? "entry" : "",
    value ? "filled" : "empty",
    conflicts.has(index) ? "conflict" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const hideLabelForQuietCandidates =
    state.stage === "solve" && !selected && !value && state.analysisOptions.showAllCandidates && !state.analysisOptions.hideSuggestions;
  let content = selected || value || hideLabelForQuietCandidates ? "" : `<span class="cell-label">${region === null ? "?" : regionLabels[region]}</span>`;

  if (state.stage === "solve" && !value && selected) {
    content += suggestionsHidden ? renderFreeDigitGrid(state.size) : renderCandidateGrid(allowed, state.size);
  } else if (state.stage === "solve" && !value && state.analysisOptions.showAllCandidates && !suggestionsHidden) {
    content += renderQuietCandidateGrid(allowed, state.size);
  } else if (value) {
    content += `<span class="value">${value}</span>`;
  }

  return `
    <div
      class="${classes}"
      style="${getCellStyle(index, state.regions, state.size)}"
      data-action="select-cell"
      data-index="${index}"
      role="button"
      tabindex="0"
      aria-label="Cell ${index + 1}"
    >
      ${content}
    </div>
  `;
}

function renderCandidateGrid(allowed, size) {
  const sole = allowed.length === 1 ? allowed[0] : null;

  return `
    <div class="candidate-grid" style="${getCandidateGridStyle(size)}">
      ${getDigits(size).map((digit) => {
        const valid = allowed.includes(digit);
        const classes = ["candidate", valid ? "valid" : "invalid", sole === digit ? "sole" : ""]
          .filter(Boolean)
          .join(" ");

        return `
          <button
            class="${classes}"
            data-action="candidate-pick"
            data-digit="${digit}"
            type="button"
            ${valid ? "" : "disabled"}
          >
            ${digit}
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderFreeDigitGrid(size) {
  return `
    <div class="candidate-grid" style="${getCandidateGridStyle(size)}">
      ${getDigits(size).map((digit) => `
        <button
          class="candidate"
          data-action="candidate-pick"
          data-digit="${digit}"
          type="button"
        >
          ${digit}
        </button>
      `).join("")}
    </div>
  `;
}

function renderQuietCandidateGrid(allowed, size) {
  const sole = allowed.length === 1 ? allowed[0] : null;

  return `
    <div class="candidate-grid candidate-grid-quiet" style="${getCandidateGridStyle(size)}" aria-hidden="true">
      ${getDigits(size).map((digit) => {
        const classes = [
          "candidate-mark",
          allowed.includes(digit) ? "available" : "blocked",
          sole === digit ? "sole" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return `<span class="${classes}">${digit}</span>`;
      }).join("")}
    </div>
  `;
}

function renderLineHelperOverlays(state) {
  if (state.stage !== "solve" || !state.analysisOptions.allowCrossLine || state.ui.lineHelperDigit === null) {
    return "";
  }

  const digit = state.ui.lineHelperDigit;
  const rows = state.lineEliminations.rows[digit];
  const columns = state.lineEliminations.columns[digit];

  if (!rows.some(Boolean) && !columns.some(Boolean)) {
    return "";
  }

  return `
    <div class="line-helper-overlays" style="--board-size:${state.size}">
      ${rows.map((active, index) => active ? `
        <div class="line-helper-overlay line-helper-overlay-row" style="--line-index:${index}">
          <span class="line-helper-overlay-label">${digit}</span>
        </div>
      ` : "").join("")}
      ${columns.map((active, index) => active ? `
        <div class="line-helper-overlay line-helper-overlay-column" style="--line-index:${index}">
          <span class="line-helper-overlay-label">${digit}</span>
        </div>
      ` : "").join("")}
    </div>
  `;
}

function renderLineHelperColumnBar(state) {
  const digit = state.ui.lineHelperDigit;

  return `
    <div class="line-helper-column-bar" data-size="${state.size}" style="${getBoardStyle(state)}">
      ${Array.from({ length: state.size }, (_, index) => `
        <button
          class="line-helper-button ${digit !== null && state.lineEliminations.columns[digit][index] ? "active" : ""}"
          data-action="toggle-line-helper-column"
          data-index="${index}"
          type="button"
          aria-label="Toggle column ${index + 1} for helper digit ${digit ?? "none"}"
        >
          ${index + 1}
        </button>
      `).join("")}
    </div>
  `;
}

function renderLineHelperRowBar(state) {
  const digit = state.ui.lineHelperDigit;

  return `
    <div class="line-helper-row-bar" data-size="${state.size}" style="${getBoardStyle(state)}">
      ${Array.from({ length: state.size }, (_, index) => `
        <button
          class="line-helper-button ${digit !== null && state.lineEliminations.rows[digit][index] ? "active" : ""}"
          data-action="toggle-line-helper-row"
          data-index="${index}"
          type="button"
          aria-label="Toggle row ${index + 1} for helper digit ${digit ?? "none"}"
        >
          ${index + 1}
        </button>
      `).join("")}
    </div>
  `;
}

function renderStatusContent(state, designStatus, regionStatus, conflicts, solved) {
  const alerts = [];
  let helper = state.message;

  if (state.stage === "design-regions" && regionStatus && !regionStatus.valid) {
    alerts.push(...regionStatus.problems);
  }

  if (!designStatus.valid && state.stage !== "design-regions") {
    alerts.push(designStatus.message);
  }

  if (conflicts.size) {
    alerts.push(`${conflicts.size} conflicting cell${conflicts.size === 1 ? "" : "s"} highlighted on the board.`);
  }

  if (!alerts.length && state.stage === "solve" && !conflicts.size && !solved && state.selectedCell === null) {
    if (state.analysisOptions.hideSuggestions) {
      helper = "Select an empty cell and enter a digit from memory.";
    } else if (!state.analysisOptions.showAllCandidates) {
      helper = "Select an empty cell to inspect its candidates.";
    }
  }

  if (!alerts.length && solved) {
    helper = "Board solved without conflicts.";
  }

  const alertMarkup = alerts.length
    ? `<ul class="status-alerts">${alerts.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ul>`
    : "";

  return `
    <p class="status-note ${alerts.length ? "status-note-quiet" : ""}">${escapeHtml(helper || "")}</p>
    ${alertMarkup}
  `;
}

function renderBoardToolbar(state) {
  const buttons = [
    `<button class="ghost" data-action="undo">Undo <span class="shortcut-hint">Ctrl+Z</span></button>`,
    `<button class="ghost" data-action="redo">Redo <span class="shortcut-hint">Ctrl+Y</span></button>`,
  ];

  if (state.stage === "solve") {
    buttons.push(`<button class="ghost" data-action="toggle-options">Options</button>`);
  }

  buttons.push(`<button class="ghost" data-action="go-home">Home</button>`);

  return `
    <div class="board-toolbar-wrap">
      <div class="board-toolbar">
        <div class="button-row board-actions">
          ${buttons.join("")}
        </div>
        ${state.stage === "solve" && state.analysisOptions.allowCrossLine ? renderLineHelperTray(state) : ""}
        <p class="toolbar-note">${escapeHtml(renderToolbarNote(state))}</p>
      </div>
      ${state.stage === "solve" && state.ui.solveOptionsOpen ? renderOptionsPopover(state) : ""}
    </div>
  `;
}

function renderLineHelperTray(state) {
  const digit = state.ui.lineHelperDigit;

  return `
    <section class="line-helper-tray stack compact-stack">
      <div class="line-helper-tray-head">
        <h2>Line Helper</h2>
        <p class="inline-note">Choose a digit, then tap a row or column marker on the board edge to toggle a visual cross-out.</p>
      </div>
      <div class="digits line-helper-digits" style="${getControlStyle(state.size)}">
        ${getDigits(state.size).map((helperDigit) => `
          <button
            class="digit-button ${digit === helperDigit ? "active" : ""}"
            data-action="select-line-helper-digit"
            data-digit="${helperDigit}"
            type="button"
          >
            ${helperDigit}
          </button>
        `).join("")}
      </div>
      <div class="button-row">
        <button class="secondary" data-action="clear-line-helper-digit" type="button" ${digit === null ? "disabled" : ""}>Clear Current Digit Marks</button>
      </div>
    </section>
  `;
}

function renderOptionsPopover(state) {
  return `
    <section class="options-popover" role="dialog" aria-label="Solve options">
      <div class="options-popover-head">
        <h2>Options</h2>
        <button class="ghost options-close" data-action="close-options" type="button">Close</button>
      </div>
      <div class="stack compact-stack">
        <label class="setting-toggle">
          <input type="checkbox" data-setting="allow-crossline" ${state.analysisOptions.allowCrossLine ? "checked" : ""}>
          <span>Allow CrossLine</span>
        </label>
        <label class="setting-toggle">
          <input type="checkbox" data-setting="hide-suggestions" ${state.analysisOptions.hideSuggestions ? "checked" : ""}>
          <span>Hide number suggestions</span>
        </label>
        <label class="setting-toggle">
          <input type="checkbox" data-setting="enable-claiming" ${state.analysisOptions.enableClaiming ? "checked" : ""}>
          <span>Enable claiming rule</span>
        </label>
        <label class="setting-toggle">
          <input type="checkbox" data-setting="show-all-candidates" ${state.analysisOptions.showAllCandidates ? "checked" : ""} ${state.analysisOptions.hideSuggestions ? "disabled" : ""}>
          <span>Show all unresolved</span>
        </label>
        <p class="inline-note">Hide number suggestions turns solve mode into memory mode: any digit can be entered in editable cells, candidate hints disappear, and conflicts are shown only through the board state.</p>
      </div>
    </section>
  `;
}

function renderDigitButtons(action, selectedCell, values, stage, state = null, selectedCandidates = []) {
  const digits = getDigits(state?.size ?? values.length);
  const suggestionsHidden = stage === "solve" && state?.analysisOptions?.hideSuggestions;

  return digits
    .map((digit) => {
      const active = selectedCell !== null && values[selectedCell] === digit;
      const disabled =
        selectedCell === null ||
        (stage === "solve" && state && !suggestionsHidden && !state.givens[selectedCell] && !selectedCandidates.includes(digit) && state.entries[selectedCell] !== digit) ||
        (stage === "solve" && state && state.givens[selectedCell]);

      return `
        <button
          class="digit-button ${active ? "active" : ""}"
          data-action="${action}"
          data-digit="${digit}"
          type="button"
          ${disabled ? "disabled" : ""}
        >
          ${digit}
        </button>
      `;
    })
    .join("");
}

function renderPaletteButton(index, label, activeRegion, size) {
  return `
    <button
      class="palette-button ${activeRegion === index ? "active" : ""}"
      style="background:${getRegionColor(index, size)}"
      data-action="select-region"
      data-region="${index}"
      type="button"
    >
      Region ${label}
    </button>
  `;
}

function renderRegionSummary(regionStatus, size) {
  if (!regionStatus) {
    return "";
  }

  const labels = getRegionLabels(size);

  return `
    <div class="meta-list">
      ${regionStatus.counts.map((count, index) => `
        <div class="meta-item">
          <span>Region ${labels[index]}</span>
          <strong>${count}/${size}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderBoardCardNumpad(state, selectedCandidates) {
  if (state.stage === "design-givens") {
    return renderNumpadSection({
      state,
      title: "Initial Digits",
      action: "set-digit",
      values: state.givens,
      stage: state.stage,
      wrapperClass: "numpad-boardcard",
    });
  }

  if (state.stage === "solve") {
    return renderNumpadSection({
      state,
      title: "Entry Pad",
      action: "play-digit",
      values: state.entries,
      stage: state.stage,
      selectedCandidates,
      wrapperClass: "numpad-boardcard",
      showImportButton: false,
    });
  }

  return "";
}

function renderNumpadSection({ state, title, action, values, stage, selectedCandidates = [], wrapperClass = "", showImportButton = true }) {
  return `
    <section class="stack control-section control-numpad ${wrapperClass}">
      <h2>${title}</h2>
      <div class="digits" style="${getControlStyle(state.size)}">${renderDigitButtons(action, state.selectedCell, values, stage, state, selectedCandidates)}</div>
      <div class="button-row">
        <button class="secondary" data-action="clear-selected-value">Clear Cell</button>
        ${showImportButton ? '<button class="secondary" data-action="trigger-import">Load JSON File</button>' : ""}
      </div>
    </section>
  `;
}

function renderStartNotice(state, classicSupported) {
  if (!classicSupported) {
    return `
      <div class="hero-note hero-note-warning">
        <p class="inline-note">Classic Sudoku is disabled for ${state.size}x${state.size}. Choose jigsaw for this size, or switch to 4x4, 6x6, 8x8, or 9x9 for classic.</p>
      </div>
    `;
  }

  if (state.message && state.message !== "Choose a board size, then start a classic or jigsaw puzzle, or load a JSON file.") {
    return `
      <div class="hero-note">
        <p class="inline-note">${escapeHtml(state.message)}</p>
      </div>
    `;
  }

  return "";
}

function getBoardStyle(state) {
  return `--board-size:${state.size}`;
}

function getControlStyle(size) {
  return `--control-columns:${getControlGridColumns(size)}`;
}

function getCandidateGridStyle(size) {
  const dimensions = getCandidateGridDimensions(size);
  return `--candidate-columns:${dimensions.columns};--candidate-rows:${dimensions.rows}`;
}

function getCellStyle(index, regions, size) {
  const region = regions[index];
  return `${getRegionEdgeStyle(index, regions, size)};background:${getRegionColor(region, size)}`;
}

function titleCase(value) {
  if (!value) {
    return "Sudoku";
  }
  return value[0].toUpperCase() + value.slice(1);
}

function renderStageLabel(stage) {
  switch (stage) {
    case "design-regions":
      return "Region Design";
    case "design-givens":
      return "Given Design";
    case "solve":
      return "Solving";
    default:
      return "Ready";
  }
}

function renderToolbarNote(state) {
  if (state.stage === "solve") {
    return `Solve mode · ${titleCase(state.variant)} ${state.size}x${state.size} · History ${state.historyCursor + 1}/${state.history.length}`;
  }

  return `${titleCase(state.variant)} ${state.size}x${state.size} · ${renderStageLabel(state.stage)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
