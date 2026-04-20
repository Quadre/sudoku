import { DEFAULT_BOARD_SIZE, getCellCount, isSupportedSize } from "./rules.js";

export async function loadJsonFile(file) {
  const text = await file.text();
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }

  validatePayload(parsed);
  return parsed;
}

export function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Imported data must be a JSON object.");
  }

  if (payload.version !== 1) {
    throw new Error("Unsupported file version.");
  }

  if (payload.saveType !== "design" && payload.saveType !== "progress") {
    throw new Error("saveType must be 'design' or 'progress'.");
  }

  if (payload.variant !== "classic" && payload.variant !== "jigsaw") {
    throw new Error("variant must be 'classic' or 'jigsaw'.");
  }

  if (payload.size === undefined) {
    payload.size = DEFAULT_BOARD_SIZE;
  }

  if (!Number.isInteger(payload.size) || !isSupportedSize(payload.size)) {
    throw new Error("size must be an integer between 3 and 9.");
  }

  const cellCount = getCellCount(payload.size);

  ensureIntArray(payload.givens, "givens", cellCount, 0, payload.size);
  ensureRegionArray(payload.regions, "regions", cellCount, payload.size);

  if (payload.saveType === "progress") {
    ensureIntArray(payload.entries, "entries", cellCount, 0, payload.size);
    if (!Array.isArray(payload.history)) {
      throw new Error("history must be an array for progress files.");
    }
    if (!Number.isInteger(payload.historyCursor) || payload.historyCursor < -1 || payload.historyCursor >= payload.history.length) {
      throw new Error("historyCursor is invalid.");
    }

    payload.history.forEach((entry, index) => {
      validateHistoryEntry(entry, index, payload.size);
    });
  }

  if (payload.analysisOptions !== undefined) {
    validateAnalysisOptions(payload.analysisOptions);
  }
}

function ensureIntArray(value, label, length, min, max) {
  if (!Array.isArray(value) || value.length !== length) {
    throw new Error(`${label} must contain exactly ${length} items.`);
  }

  value.forEach((item, index) => {
    if (!Number.isInteger(item) || item < min || item > max) {
      throw new Error(`${label}[${index}] must be an integer between ${min} and ${max}.`);
    }
  });
}

function ensureRegionArray(value, label, length, size) {
  if (!Array.isArray(value) || value.length !== length) {
    throw new Error(`${label} must contain exactly ${length} items.`);
  }

  value.forEach((item, index) => {
    if (item !== null && (!Number.isInteger(item) || item < 0 || item >= size)) {
      throw new Error(`${label}[${index}] must be null or an integer between 0 and ${size - 1}.`);
    }
  });
}

function validateHistoryEntry(entry, index, size) {
  if (!entry || typeof entry !== "object") {
    throw new Error(`history[${index}] must be an object.`);
  }

  switch (entry.type) {
    case "paint-region":
      ensureIndex(entry.index, `history[${index}].index`, size);
      ensureNullableRegion(entry.before, `history[${index}].before`, size);
      ensureNullableRegion(entry.after, `history[${index}].after`, size);
      break;
    case "set-given":
    case "set-entry":
      ensureIndex(entry.index, `history[${index}].index`, size);
      ensureDigit(entry.before, `history[${index}].before`, size);
      ensureDigit(entry.after, `history[${index}].after`, size);
      break;
    case "bulk-regions":
      ensureRegionArray(entry.before, `history[${index}].before`, getCellCount(size), size);
      ensureRegionArray(entry.after, `history[${index}].after`, getCellCount(size), size);
      break;
    default:
      throw new Error(`history[${index}].type is unsupported.`);
  }
}

function ensureIndex(value, label, size) {
  const maxIndex = getCellCount(size) - 1;
  if (!Number.isInteger(value) || value < 0 || value > maxIndex) {
    throw new Error(`${label} must be an integer between 0 and ${maxIndex}.`);
  }
}

function ensureDigit(value, label, size) {
  if (!Number.isInteger(value) || value < 0 || value > size) {
    throw new Error(`${label} must be an integer between 0 and ${size}.`);
  }
}

function ensureNullableRegion(value, label, size) {
  if (value !== null && (!Number.isInteger(value) || value < 0 || value >= size)) {
    throw new Error(`${label} must be null or an integer between 0 and ${size - 1}.`);
  }
}

function validateAnalysisOptions(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("analysisOptions must be an object when provided.");
  }

  if (value.hideSuggestions !== undefined && typeof value.hideSuggestions !== "boolean") {
    throw new Error("analysisOptions.hideSuggestions must be a boolean.");
  }

  if (value.allowCrossLine !== undefined && typeof value.allowCrossLine !== "boolean") {
    throw new Error("analysisOptions.allowCrossLine must be a boolean.");
  }

  if (value.enableClaiming !== undefined && typeof value.enableClaiming !== "boolean") {
    throw new Error("analysisOptions.enableClaiming must be a boolean.");
  }

  if (value.showAllCandidates !== undefined && typeof value.showAllCandidates !== "boolean") {
    throw new Error("analysisOptions.showAllCandidates must be a boolean.");
  }
}