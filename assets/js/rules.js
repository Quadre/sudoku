export const DEFAULT_BOARD_SIZE = 6;

const SUPPORTED_SIZES = [3, 4, 5, 6, 7, 8, 9];
const CLASSIC_BOX_SHAPES = {
  4: { rows: 2, columns: 2 },
  6: { rows: 2, columns: 3 },
  8: { rows: 2, columns: 4 },
  9: { rows: 3, columns: 3 },
};
const LABEL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function getSupportedSizes() {
  return [...SUPPORTED_SIZES];
}

export function isSupportedSize(size) {
  return SUPPORTED_SIZES.includes(size);
}

export function isClassicSizeSupported(size) {
  return Object.hasOwn(CLASSIC_BOX_SHAPES, size);
}

export function getClassicBoxShape(size) {
  const shape = CLASSIC_BOX_SHAPES[size];
  return shape ? { ...shape } : null;
}

export function getCellCount(size) {
  return size * size;
}

export function getDigits(size) {
  return Array.from({ length: size }, (_, index) => index + 1);
}

export function getRegionCount(size) {
  return size;
}

export function getRegionLabels(size) {
  if (size <= LABEL_ALPHABET.length) {
    return LABEL_ALPHABET.slice(0, size).split("");
  }

  return Array.from({ length: size }, (_, index) => `R${index + 1}`);
}

export function getCandidateGridDimensions(size) {
  const columns = size <= 4 ? 2 : 3;

  return {
    columns,
    rows: Math.ceil(size / columns),
  };
}

export function getControlGridColumns(size) {
  return size <= 4 ? 2 : 3;
}

export function getRegionColor(region, size) {
  if (region === null || region < 0) {
    return "rgba(255, 252, 247, 0.88)";
  }

  const hue = Math.round((360 / Math.max(size, 1)) * region);
  const lightness = 80 - (region % 3) * 4;
  return `hsla(${hue}, 64%, ${lightness}%, 0.62)`;
}

export function createClassicRegions(size) {
  const boxShape = getClassicBoxShape(size);
  if (!boxShape) {
    throw new Error(`Classic mode is not supported for ${size}x${size}.`);
  }

  const regions = new Array(getCellCount(size)).fill(null);
  const regionColumns = size / boxShape.columns;

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const region =
        Math.floor(row / boxShape.rows) * regionColumns +
        Math.floor(column / boxShape.columns);
      regions[toIndex(row, column, size)] = region;
    }
  }

  return regions;
}

export function createEmptyRegions(size) {
  return new Array(getCellCount(size)).fill(null);
}

export function createEmptyValues(size) {
  return new Array(getCellCount(size)).fill(0);
}

export function toIndex(row, column, size) {
  return row * size + column;
}

export function toRowColumn(index, size) {
  return {
    row: Math.floor(index / size),
    column: index % size,
  };
}

export function getValueAt(givens, entries, index) {
  return givens[index] || entries[index] || 0;
}

export function getCurrentValues(givens, entries) {
  return givens.map((given, index) => given || entries[index] || 0);
}

export function getGroups(regions, size) {
  const rows = [];
  const columns = [];
  const regionGroups = Array.from({ length: getRegionCount(size) }, () => []);

  for (let row = 0; row < size; row += 1) {
    rows.push(Array.from({ length: size }, (_, column) => toIndex(row, column, size)));
  }

  for (let column = 0; column < size; column += 1) {
    columns.push(Array.from({ length: size }, (_, row) => toIndex(row, column, size)));
  }

  regions.forEach((region, index) => {
    if (typeof region === "number" && region >= 0 && region < getRegionCount(size)) {
      regionGroups[region].push(index);
    }
  });

  return {
    rows,
    columns,
    regions: regionGroups,
  };
}

export function findConflicts(values, regions, size) {
  const conflicts = new Set();
  const groups = getGroups(regions, size);
  const allGroups = [...groups.rows, ...groups.columns, ...groups.regions];

  allGroups.forEach((group) => {
    const seen = new Map();
    group.forEach((index) => {
      const value = values[index];
      if (!value) {
        return;
      }

      if (!seen.has(value)) {
        seen.set(value, [index]);
        return;
      }

      seen.get(value).push(index);
    });

    seen.forEach((indexes) => {
      if (indexes.length > 1) {
        indexes.forEach((index) => conflicts.add(index));
      }
    });
  });

  return conflicts;
}

export function getPeerIndexes(index, regions, size) {
  const { row, column } = toRowColumn(index, size);
  const peerSet = new Set();

  for (let pointer = 0; pointer < size; pointer += 1) {
    peerSet.add(toIndex(row, pointer, size));
    peerSet.add(toIndex(pointer, column, size));
  }

  const region = regions[index];
  if (typeof region === "number") {
    regions.forEach((candidateRegion, candidateIndex) => {
      if (candidateRegion === region) {
        peerSet.add(candidateIndex);
      }
    });
  }

  peerSet.delete(index);
  return [...peerSet];
}

export function getAllowedDigits(values, regions, index, size, options = {}) {
  if (values[index]) {
    return [];
  }

  const candidateMap = getCandidateMap(values, regions, size, options);
  return candidateMap[index];
}

export function getCandidateMap(values, regions, size, options = {}) {
  const directCandidates = values.map((value, index) => (value ? [] : getDirectAllowedDigits(values, regions, index, size)));
  const lockedEliminations = getLockedCandidateEliminations(directCandidates, regions, size, options);

  return directCandidates.map((candidates, index) => {
    if (!candidates.length) {
      return candidates;
    }

    const blockedDigits = lockedEliminations[index];
    if (!blockedDigits || blockedDigits.size === 0) {
      return candidates;
    }

    return candidates.filter((digit) => !blockedDigits.has(digit));
  });
}

function getDirectAllowedDigits(values, regions, index, size) {
  if (values[index]) {
    return [];
  }

  const used = new Set();
  getPeerIndexes(index, regions, size).forEach((peerIndex) => {
    const peerValue = values[peerIndex];
    if (peerValue) {
      used.add(peerValue);
    }
  });

  return getDigits(size).filter((digit) => !used.has(digit));
}

function getLockedCandidateEliminations(candidateMap, regions, size, options) {
  const eliminations = Array.from({ length: getCellCount(size) }, () => new Set());
  const groups = getGroups(regions, size);
  const digits = getDigits(size);

  groups.regions.forEach((regionCells, regionId) => {
    digits.forEach((digit) => {
      const candidateCells = regionCells.filter((index) => candidateMap[index].includes(digit));

      if (candidateCells.length < 2) {
        return;
      }

      const rows = new Set(candidateCells.map((index) => toRowColumn(index, size).row));
      const columns = new Set(candidateCells.map((index) => toRowColumn(index, size).column));

      if (rows.size === 1) {
        const row = [...rows][0];
        groups.rows[row].forEach((index) => {
          if (regions[index] !== regionId) {
            eliminations[index].add(digit);
          }
        });
      }

      if (columns.size === 1) {
        const column = [...columns][0];
        groups.columns[column].forEach((index) => {
          if (regions[index] !== regionId) {
            eliminations[index].add(digit);
          }
        });
      }
    });
  });

  if (options.enableClaiming) {
    applyClaimingEliminations(candidateMap, groups, regions, size, eliminations);
  }

  return eliminations;
}

function applyClaimingEliminations(candidateMap, groups, regions, size, eliminations) {
  const lineGroups = [...groups.rows, ...groups.columns];
  const digits = getDigits(size);

  lineGroups.forEach((lineCells) => {
    digits.forEach((digit) => {
      const candidateCells = lineCells.filter((index) => candidateMap[index].includes(digit));

      if (candidateCells.length < 2) {
        return;
      }

      const regionIds = new Set(candidateCells.map((index) => regions[index]));
      if (regionIds.size !== 1) {
        return;
      }

      const regionId = [...regionIds][0];
      if (typeof regionId !== "number") {
        return;
      }

      groups.regions[regionId].forEach((index) => {
        if (!lineCells.includes(index)) {
          eliminations[index].add(digit);
        }
      });
    });
  });
}

export function validateJigsawRegions(regions, size) {
  const problems = [];
  const groups = getGroups(regions, size).regions;
  const labels = getRegionLabels(size);
  const unassigned = regions.filter((region) => region === null).length;

  if (unassigned) {
    problems.push(`${unassigned} cell${unassigned === 1 ? " is" : "s are"} not assigned to a region.`);
  }

  groups.forEach((group, region) => {
    if (group.length !== size) {
      problems.push(`Region ${labels[region]} must contain exactly ${size} cells.`);
    }

    if (group.length > 0 && !isOrthogonallyConnected(group, size)) {
      problems.push(`Region ${labels[region]} must be orthogonally connected.`);
    }
  });

  return {
    valid: problems.length === 0,
    problems,
    counts: groups.map((group) => group.length),
  };
}

function isOrthogonallyConnected(group, size) {
  if (group.length <= 1) {
    return true;
  }

  const targets = new Set(group);
  const queue = [group[0]];
  const visited = new Set(queue);

  while (queue.length > 0) {
    const current = queue.shift();
    getOrthogonalNeighbors(current, size).forEach((neighbor) => {
      if (!targets.has(neighbor) || visited.has(neighbor)) {
        return;
      }

      visited.add(neighbor);
      queue.push(neighbor);
    });
  }

  return visited.size === targets.size;
}

function getOrthogonalNeighbors(index, size) {
  const { row, column } = toRowColumn(index, size);
  const neighbors = [];

  if (row > 0) {
    neighbors.push(toIndex(row - 1, column, size));
  }
  if (row < size - 1) {
    neighbors.push(toIndex(row + 1, column, size));
  }
  if (column > 0) {
    neighbors.push(toIndex(row, column - 1, size));
  }
  if (column < size - 1) {
    neighbors.push(toIndex(row, column + 1, size));
  }

  return neighbors;
}

export function boardHasConflicts(givens, entries, regions, size) {
  return findConflicts(getCurrentValues(givens, entries), regions, size).size > 0;
}

export function canPlaceDigit(givens, entries, regions, index, digit, size, options = {}) {
  if (givens[index]) {
    return false;
  }

  const values = getCurrentValues(givens, entries);
  values[index] = 0;
  return getAllowedDigits(values, regions, index, size, options).includes(digit);
}

export function getRegionEdgeStyle(index, regions, size) {
  const { row, column } = toRowColumn(index, size);
  const region = regions[index];
  const north = row > 0 ? regions[toIndex(row - 1, column, size)] : null;
  const south = row < size - 1 ? regions[toIndex(row + 1, column, size)] : null;
  const west = column > 0 ? regions[toIndex(row, column - 1, size)] : null;
  const east = column < size - 1 ? regions[toIndex(row, column + 1, size)] : null;

  return [
    `border-top:${north === region ? "1px" : "4px"} solid rgba(50, 35, 23, 0.86)`,
    `border-bottom:${south === region ? "1px" : "4px"} solid rgba(50, 35, 23, 0.86)`,
    `border-left:${west === region ? "1px" : "4px"} solid rgba(50, 35, 23, 0.86)`,
    `border-right:${east === region ? "1px" : "4px"} solid rgba(50, 35, 23, 0.86)`,
  ].join(";");
}