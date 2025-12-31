import { createRng } from "../prng.js";
import { bfs } from "../pathfinding.js";

const PRESETS = {
  A: {
    microExtraLoopsProbability: 0.1,
    doorCountPerMacroEdge: 1,
  },
  B: {
    microExtraLoopsProbability: 0.25,
    doorCountPerMacroEdge: 1,
    addRooms: true,
  },
  C: {
    microExtraLoopsProbability: 0.1,
    doorCountPerMacroEdge: 1,
    addMesoLoops: true,
  },
};

function createMacroGraph(width, height, rng) {
  const total = width * height;
  const edges = Array.from({ length: total }, () => new Set());
  const visited = new Set();
  const stack = [0];
  visited.add(0);
  while (stack.length) {
    const current = stack[stack.length - 1];
    const cx = current % width;
    const cy = Math.floor(current / width);
    const neighbors = [];
    if (cx > 0) neighbors.push(current - 1);
    if (cx < width - 1) neighbors.push(current + 1);
    if (cy > 0) neighbors.push(current - width);
    if (cy < height - 1) neighbors.push(current + width);
    const unvisited = neighbors.filter((n) => !visited.has(n));
    if (unvisited.length === 0) {
      stack.pop();
      continue;
    }
    const next = unvisited[rng.intBetween(0, unvisited.length - 1)];
    edges[current].add(next);
    edges[next].add(current);
    visited.add(next);
    stack.push(next);
  }
  return edges;
}

function generateMicroMaze(size, rng, preset) {
  const grid = Array.from({ length: size }, () => Array(size).fill(1));
  const cells = [];
  for (let y = 1; y < size; y += 2) {
    for (let x = 1; x < size; x += 2) {
      cells.push([x, y]);
      grid[y][x] = 0;
    }
  }
  const cellIndex = (x, y) => ((y - 1) / 2) * Math.ceil(size / 2) + (x - 1) / 2;
  const visited = new Set();
  const stack = [cells[rng.intBetween(0, cells.length - 1)]];
  visited.add(cellIndex(stack[0][0], stack[0][1]));
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const neighbors = [];
    if (x - 2 > 0) neighbors.push([x - 2, y]);
    if (x + 2 < size) neighbors.push([x + 2, y]);
    if (y - 2 > 0) neighbors.push([x, y - 2]);
    if (y + 2 < size) neighbors.push([x, y + 2]);
    const unvisited = neighbors.filter(
      ([nx, ny]) => !visited.has(cellIndex(nx, ny))
    );
    if (unvisited.length === 0) {
      stack.pop();
      continue;
    }
    const [nx, ny] = unvisited[rng.intBetween(0, unvisited.length - 1)];
    grid[(y + ny) / 2][(x + nx) / 2] = 0;
    visited.add(cellIndex(nx, ny));
    stack.push([nx, ny]);
  }

  let extraLoops = 0;
  for (let y = 1; y < size - 1; y += 2) {
    for (let x = 1; x < size - 1; x += 2) {
      const walls = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];
      for (const [wx, wy] of walls) {
        if (grid[wy][wx] === 1 && rng.next() < preset.microExtraLoopsProbability) {
          grid[wy][wx] = 0;
          extraLoops += 1;
        }
      }
    }
  }

  if (preset.addRooms) {
    const roomCount = rng.intBetween(1, 2);
    for (let i = 0; i < roomCount; i += 1) {
      const rx = rng.intBetween(1, size - 3);
      const ry = rng.intBetween(1, size - 3);
      grid[ry][rx] = 0;
      grid[ry + 1][rx] = 0;
      grid[ry][rx + 1] = 0;
      grid[ry + 1][rx + 1] = 0;
    }
  }

  if (preset.addMesoLoops) {
    for (let i = 0; i < 2; i += 1) {
      const y = rng.intBetween(2, size - 3);
      for (let x = 1; x < size - 1; x += 1) {
        if (rng.next() < 0.2) {
          grid[y][x] = 0;
        }
      }
    }
  }

  return { grid, extraLoops };
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

function carveDoorConnection(grid, x, y, dx, dy) {
  const nx = x + dx;
  const ny = y + dy;
  if (grid[ny] && grid[ny][nx] !== undefined) {
    grid[ny][nx] = 0;
  }
}

function findFarthestInBlock(dist, blockX, blockY, blockSize) {
  const startX = 1 + blockX * blockSize;
  const startY = 1 + blockY * blockSize;
  let best = null;
  let bestDist = -1;
  for (let y = 0; y < blockSize; y += 1) {
    for (let x = 0; x < blockSize; x += 1) {
      const d = dist[startY + y][startX + x];
      if (d === -1) {
        continue;
      }
      if (d > bestDist) {
        bestDist = d;
        best = [startX + x, startY + y];
      }
    }
  }
  return { cell: best, distance: bestDist };
}

export function generateHierarchical({ width, height, seed, presetName }) {
  const preset = PRESETS[presetName] || PRESETS.A;
  const rng = createRng(seed);
  const macroW = 9;
  const macroH = 5;
  const blockSize = 11;
  const macroEdges = createMacroGraph(macroW, macroH, rng);
  const macroEdgesCount = macroEdges.reduce((sum, edges) => sum + edges.size, 0) / 2;

  const blocks = [];
  let microLoopsAdded = 0;
  for (let by = 0; by < macroH; by += 1) {
    for (let bx = 0; bx < macroW; bx += 1) {
      const micro = generateMicroMaze(blockSize, rng, preset);
      blocks.push(micro.grid);
      microLoopsAdded += micro.extraLoops;
    }
  }

  const grid = Array.from({ length: height }, () => Array(width).fill(1));
  for (let by = 0; by < macroH; by += 1) {
    for (let bx = 0; bx < macroW; bx += 1) {
      const block = blocks[by * macroW + bx];
      const startX = 1 + bx * blockSize;
      const startY = 1 + by * blockSize;
      for (let y = 0; y < blockSize; y += 1) {
        for (let x = 0; x < blockSize; x += 1) {
          grid[startY + y][startX + x] = block[y][x];
        }
      }
    }
  }

  let doorsPlaced = 0;
  for (let idx = 0; idx < macroEdges.length; idx += 1) {
    const neighbors = Array.from(macroEdges[idx]);
    for (const n of neighbors) {
      if (n < idx) {
        continue;
      }
      const ax = idx % macroW;
      const ay = Math.floor(idx / macroW);
      const bx = n % macroW;
      const by = Math.floor(n / macroW);
      if (ax === bx) {
        const boundaryY = ay < by ? ay * blockSize + blockSize : ay * blockSize;
        const t = [1, 3, 5, 7, 9][rng.intBetween(0, 4)];
        const x = 1 + ax * blockSize + t;
        const y1 = 1 + boundaryY - 1;
        const y2 = 1 + boundaryY;
        grid[y1][x] = 0;
        grid[y2][x] = 0;
        carveDoorConnection(grid, x, y1, 0, -1);
        carveDoorConnection(grid, x, y2, 0, 1);
      } else {
        const boundaryX = ax < bx ? ax * blockSize + blockSize : ax * blockSize;
        const t = [1, 3, 5, 7, 9][rng.intBetween(0, 4)];
        const x1 = 1 + boundaryX - 1;
        const x2 = 1 + boundaryX;
        const y = 1 + ay * blockSize + t;
        grid[y][x1] = 0;
        grid[y][x2] = 0;
        carveDoorConnection(grid, x1, y, -1, 0);
        carveDoorConnection(grid, x2, y, 1, 0);
      }
      doorsPlaced += preset.doorCountPerMacroEdge;
    }
  }

  for (let y = 0; y < height; y += 1) {
    grid[y][0] = 1;
    grid[y][width - 1] = 1;
  }
  for (let x = 0; x < width; x += 1) {
    grid[0][x] = 1;
    grid[height - 1][x] = 1;
  }

  const startCandidates = [];
  const startBlockX = 0;
  const startBlockY = 0;
  const startX = 1 + startBlockX * blockSize;
  const startY = 1 + startBlockY * blockSize;
  for (let y = 0; y < blockSize; y += 1) {
    for (let x = 0; x < blockSize; x += 1) {
      if (grid[startY + y][startX + x] === 0) {
        startCandidates.push([startX + x, startY + y]);
      }
    }
  }
  const start = startCandidates[rng.intBetween(0, startCandidates.length - 1)];
  const { dist } = bfs(grid, start);
  let { cell: exit, distance } = findFarthestInBlock(dist, macroW - 1, macroH - 1, blockSize);
  if (!exit) {
    let fallback = [start[0], start[1]];
    let best = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const d = dist[y][x];
        if (d > best) {
          best = d;
          fallback = [x, y];
        }
      }
    }
    exit = fallback;
    distance = best;
  }

  return {
    grid,
    start,
    exit,
    pathLength: distance,
    stats: {
      macroEdgesCount,
      doorsPlacedBetweenBlocks: doorsPlaced,
      microLoopsAdded,
      openPct: openPct(grid),
    },
    preset: presetName,
    seed,
  };
}

