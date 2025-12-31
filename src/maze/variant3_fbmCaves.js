import { createRng } from "../prng.js";
import { bfs, farthestCell, reconstructPath } from "../pathfinding.js";

const PRESETS = {
  A: {
    octaves: 5,
    lacunarity: 2.0,
    gain: 0.5,
    scale: 0.08,
    threshold: 0.05,
    corridorRadius: 1,
    branchCount: 12,
    smoothIterations: 0,
  },
  B: {
    octaves: 5,
    lacunarity: 2.0,
    gain: 0.5,
    scale: 0.075,
    threshold: 0.0,
    corridorRadius: 1,
    branchCount: 8,
    smoothIterations: 0,
  },
  C: {
    octaves: 5,
    lacunarity: 2.0,
    gain: 0.5,
    scale: 0.09,
    threshold: 0.08,
    corridorRadius: 1,
    branchCount: 16,
    smoothIterations: 0,
  },
};

function hash2d(x, y, seed) {
  let h = seed ^ (x * 374761393) ^ (y * 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function valueNoise(x, y, seed) {
  const x0 = Math.floor(x);
  const x1 = x0 + 1;
  const y0 = Math.floor(y);
  const y1 = y0 + 1;
  const sx = fade(x - x0);
  const sy = fade(y - y0);

  const n00 = (hash2d(x0, y0, seed) / 4294967296) * 2 - 1;
  const n10 = (hash2d(x1, y0, seed) / 4294967296) * 2 - 1;
  const n01 = (hash2d(x0, y1, seed) / 4294967296) * 2 - 1;
  const n11 = (hash2d(x1, y1, seed) / 4294967296) * 2 - 1;

  const ix0 = lerp(n00, n10, sx);
  const ix1 = lerp(n01, n11, sx);
  return lerp(ix0, ix1, sy);
}

function fbm(x, y, seed, preset) {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let max = 0;
  for (let i = 0; i < preset.octaves; i += 1) {
    sum += valueNoise(x * frequency, y * frequency, seed) * amplitude;
    max += amplitude;
    amplitude *= preset.gain;
    frequency *= preset.lacunarity;
  }
  return sum / max;
}

function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

function smoothGrid(grid) {
  const height = grid.length;
  const width = grid[0].length;
  const next = cloneGrid(grid);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let walls = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) {
            continue;
          }
          if (grid[y + dy][x + dx] === 1) {
            walls += 1;
          }
        }
      }
      next[y][x] = walls >= 5 ? 1 : 0;
    }
  }
  return next;
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

function keepLargestComponent(grid) {
  const height = grid.length;
  const width = grid[0].length;
  const visited = Array.from({ length: height }, () => Array(width).fill(false));
  let largest = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (grid[y][x] === 1 || visited[y][x]) {
        continue;
      }
      const component = [];
      const queue = [[x, y]];
      visited[y][x] = true;
      let head = 0;
      while (head < queue.length) {
        const [cx, cy] = queue[head++];
        component.push([cx, cy]);
        const next = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ];
        for (const [nx, ny] of next) {
          if (nx <= 0 || ny <= 0 || nx >= width - 1 || ny >= height - 1) {
            continue;
          }
          if (grid[ny][nx] === 1 || visited[ny][nx]) {
            continue;
          }
          visited[ny][nx] = true;
          queue.push([nx, ny]);
        }
      }
      if (component.length > largest.length) {
        largest = component;
      }
    }
  }
  const keep = new Set(largest.map(([x, y]) => `${x},${y}`));
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (grid[y][x] === 0 && !keep.has(`${x},${y}`)) {
        grid[y][x] = 1;
      }
    }
  }
  return { grid, largestSize: largest.length };
}

function randomFloorCell(grid, rng) {
  const candidates = [];
  for (let y = 1; y < grid.length - 1; y += 1) {
    for (let x = 1; x < grid[0].length - 1; x += 1) {
      if (grid[y][x] === 0) {
        candidates.push([x, y]);
      }
    }
  }
  return candidates[rng.intBetween(0, candidates.length - 1)];
}

function carveCorridor(grid, path, radius) {
  const height = grid.length;
  const width = grid[0].length;
  for (const [x, y] of path) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx <= 0 || ny <= 0 || nx >= width - 1 || ny >= height - 1) {
          continue;
        }
        grid[ny][nx] = 0;
      }
    }
  }
}

function carveBranches(grid, rng, path, count) {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  let totalLength = 0;
  for (let i = 0; i < count; i += 1) {
    const origin = path[rng.intBetween(0, path.length - 1)];
    const length = Math.floor(10 + 60 * Math.pow(rng.next(), 2));
    totalLength += length;
    let [x, y] = origin;
    let dir = dirs[rng.intBetween(0, dirs.length - 1)];
    for (let step = 0; step < length; step += 1) {
      if (rng.next() > 0.6) {
        dir = dirs[rng.intBetween(0, dirs.length - 1)];
      }
      x += dir[0];
      y += dir[1];
      if (x <= 1 || y <= 1 || x >= grid[0].length - 2 || y >= grid.length - 2) {
        break;
      }
      grid[y][x] = 0;
      if (rng.next() < 0.3) {
        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (grid[ny] && grid[ny][nx] !== undefined) {
            grid[ny][nx] = 0;
          }
        }
      }
    }
  }
  return totalLength / Math.max(count, 1);
}

export function generateFbmCaves({ width, height, seed, presetName }) {
  const preset = PRESETS[presetName] || PRESETS.A;
  const rng = createRng(seed);
  const grid = Array.from({ length: height }, () => Array(width).fill(1));

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const v = fbm(x * preset.scale, y * preset.scale, seed, preset);
      grid[y][x] = v > preset.threshold ? 0 : 1;
    }
  }

  const openBefore = openPct(grid);
  const { largestSize } = keepLargestComponent(grid);
  const openAfter = openPct(grid);

  const start = randomFloorCell(grid, rng);
  const { dist, parent } = bfs(grid, start);
  const { cell: exit, distance } = farthestCell(dist);
  const path = reconstructPath(parent, start, exit);
  carveCorridor(grid, path, preset.corridorRadius);
  const avgBranchLen = carveBranches(grid, rng, path, preset.branchCount);

  let smoothingApplied = false;
  if (preset.smoothIterations > 0) {
    let smoothed = cloneGrid(grid);
    for (let i = 0; i < preset.smoothIterations; i += 1) {
      smoothed = smoothGrid(smoothed);
    }
    const { dist: afterDist } = bfs(smoothed, start);
    if (afterDist[exit[1]][exit[0]] !== -1) {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          grid[y][x] = smoothed[y][x];
        }
      }
      smoothingApplied = true;
    }
  }

  const { dist: finalDist } = bfs(grid, start);
  const pathLength = finalDist[exit[1]][exit[0]];

  return {
    grid,
    start,
    exit,
    pathLength,
    stats: {
      openPctBefore: openBefore,
      openPctAfter: openAfter,
      largestComponentSize: largestSize,
      branchCount: preset.branchCount,
      avgBranchLen,
      smoothingApplied,
      scale: preset.scale,
      threshold: preset.threshold,
      octaves: preset.octaves,
    },
    preset: presetName,
    seed,
  };
}

