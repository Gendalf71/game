import { createRng } from "../prng.js";
import { bfs, farthestCell } from "../pathfinding.js";

const PRESETS = {
  A: {
    minRectSize: 7,
    doorMinSpacing: 5,
    doorCount(depth) {
      return depth <= 2 ? 2 : 1;
    },
    extraDoors: null,
  },
  B: {
    minRectSize: 5,
    doorMinSpacing: 3,
    doorCount(depth) {
      return depth <= 1 ? 2 : 1;
    },
    extraDoors: null,
  },
  C: {
    minRectSize: 7,
    doorMinSpacing: 5,
    doorCount(depth) {
      return depth <= 3 ? 2 : 1;
    },
    extraDoors(depth, rng) {
      if (depth <= 1 && rng.next() < 0.25) {
        return 1;
      }
      return 0;
    },
  },
};

function randomEvenBetween(rng, min, max) {
  const start = min % 2 === 0 ? min : min + 1;
  const end = max % 2 === 0 ? max : max - 1;
  if (start > end) {
    return null;
  }
  const count = Math.floor((end - start) / 2) + 1;
  const idx = rng.intBetween(0, count - 1);
  return start + idx * 2;
}

function randomOddBetween(rng, min, max) {
  const start = min % 2 === 1 ? min : min + 1;
  const end = max % 2 === 1 ? max : max - 1;
  if (start > end) {
    return null;
  }
  const count = Math.floor((end - start) / 2) + 1;
  const idx = rng.intBetween(0, count - 1);
  return start + idx * 2;
}

function chooseDoors(rng, positions, count, minSpacing) {
  const shuffled = positions.slice();
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = rng.intBetween(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const chosen = [];
  for (const pos of shuffled) {
    if (chosen.length >= count) {
      break;
    }
    if (chosen.every((c) => Math.abs(c - pos) >= minSpacing)) {
      chosen.push(pos);
    }
  }
  while (chosen.length < count && positions.length > 0) {
    chosen.push(positions[rng.intBetween(0, positions.length - 1)]);
  }
  return chosen;
}

function divide(grid, rect, depth, preset, rng, stats) {
  const width = rect.x2 - rect.x1 + 1;
  const height = rect.y2 - rect.y1 + 1;
  if (width < preset.minRectSize || height < preset.minRectSize) {
    stats.maxDepth = Math.max(stats.maxDepth, depth);
    return;
  }

  let orientation = "vertical";
  if (width > height) {
    orientation = rng.next() < 0.65 ? "vertical" : "horizontal";
  } else if (height > width) {
    orientation = rng.next() < 0.65 ? "horizontal" : "vertical";
  } else {
    orientation = rng.next() < 0.5 ? "vertical" : "horizontal";
  }

  if (orientation === "vertical") {
    const wallX = randomEvenBetween(rng, rect.x1 + 1, rect.x2 - 1);
    if (wallX === null) {
      stats.maxDepth = Math.max(stats.maxDepth, depth);
      return;
    }
    for (let y = rect.y1; y <= rect.y2; y += 1) {
      if (grid[y][wallX] === 0) {
        grid[y][wallX] = 1;
        stats.wallsPlaced += 1;
      }
    }

    const doorCountBase = preset.doorCount(depth);
    const extra = preset.extraDoors ? preset.extraDoors(depth, rng) : 0;
    const doorCount = doorCountBase + extra;
    const positions = [];
    for (let y = rect.y1; y <= rect.y2; y += 1) {
      if (y % 2 === 1) {
        positions.push(y);
      }
    }
    const doors = chooseDoors(rng, positions, doorCount, preset.doorMinSpacing);
    for (const y of doors) {
      grid[y][wallX] = 0;
    }
    stats.doorCountTotal += doors.length;

    divide(
      grid,
      { x1: rect.x1, y1: rect.y1, x2: wallX - 1, y2: rect.y2 },
      depth + 1,
      preset,
      rng,
      stats
    );
    divide(
      grid,
      { x1: wallX + 1, y1: rect.y1, x2: rect.x2, y2: rect.y2 },
      depth + 1,
      preset,
      rng,
      stats
    );
  } else {
    const wallY = randomEvenBetween(rng, rect.y1 + 1, rect.y2 - 1);
    if (wallY === null) {
      stats.maxDepth = Math.max(stats.maxDepth, depth);
      return;
    }
    for (let x = rect.x1; x <= rect.x2; x += 1) {
      if (grid[wallY][x] === 0) {
        grid[wallY][x] = 1;
        stats.wallsPlaced += 1;
      }
    }

    const doorCountBase = preset.doorCount(depth);
    const extra = preset.extraDoors ? preset.extraDoors(depth, rng) : 0;
    const doorCount = doorCountBase + extra;
    const positions = [];
    for (let x = rect.x1; x <= rect.x2; x += 1) {
      if (x % 2 === 1) {
        positions.push(x);
      }
    }
    const doors = chooseDoors(rng, positions, doorCount, preset.doorMinSpacing);
    for (const x of doors) {
      grid[wallY][x] = 0;
    }
    stats.doorCountTotal += doors.length;

    divide(
      grid,
      { x1: rect.x1, y1: rect.y1, x2: rect.x2, y2: wallY - 1 },
      depth + 1,
      preset,
      rng,
      stats
    );
    divide(
      grid,
      { x1: rect.x1, y1: wallY + 1, x2: rect.x2, y2: rect.y2 },
      depth + 1,
      preset,
      rng,
      stats
    );
  }
}

function buildGrid(width, height) {
  const grid = Array.from({ length: height }, () => Array(width).fill(0));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        grid[y][x] = 1;
      }
    }
  }
  return grid;
}

function pickStart(grid, rng) {
  const height = grid.length;
  const width = grid[0].length;
  const maxX = Math.floor((width - 2) / 4);
  const candidates = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x <= maxX; x += 1) {
      if (grid[y][x] === 0) {
        candidates.push([x, y]);
      }
    }
  }
  return candidates[rng.intBetween(0, candidates.length - 1)];
}

function openPct(grid) {
  let open = 0;
  const total = grid.length * grid[0].length;
  for (const row of grid) {
    for (const cell of row) {
      if (cell === 0) {
        open += 1;
      }
    }
  }
  return open / total;
}

function generateOnce(width, height, preset, rng) {
  const grid = buildGrid(width, height);
  const stats = { maxDepth: 0, wallsPlaced: 0, doorCountTotal: 0 };
  divide(grid, { x1: 1, y1: 1, x2: width - 2, y2: height - 2 }, 0, preset, rng, stats);
  const start = pickStart(grid, rng);
  const { dist, parent } = bfs(grid, start);
  const { cell: exit, distance } = farthestCell(dist);
  const pathLength = distance;
  return {
    grid,
    start,
    exit,
    pathLength,
    stats: {
      ...stats,
      openPct: openPct(grid),
    },
  };
}

export function generateRecursiveDivision({ width, height, seed, presetName }) {
  const preset = PRESETS[presetName] || PRESETS.A;
  const baseRng = createRng(seed);
  const maxAttempts = 6;
  const minDistance = 0.3 * Math.hypot(width, height);
  let last = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const subSeed = baseRng.nextUint32();
    const rng = createRng(subSeed);
    const result = generateOnce(width, height, preset, rng);
    last = result;
    if (result.pathLength >= minDistance) {
      return {
        ...result,
        seed,
        preset: presetName,
      };
    }
  }
  return {
    ...last,
    seed,
    preset: presetName,
  };
}
