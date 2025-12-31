export function bfs(grid, start) {
  const height = grid.length;
  const width = grid[0].length;
  const dist = Array.from({ length: height }, () => Array(width).fill(-1));
  const parent = Array.from({ length: height }, () => Array(width).fill(null));
  const queue = [];
  queue.push(start);
  dist[start[1]][start[0]] = 0;
  let head = 0;
  while (head < queue.length) {
    const [x, y] = queue[head++];
    const next = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of next) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      if (grid[ny][nx] === 1) {
        continue;
      }
      if (dist[ny][nx] !== -1) {
        continue;
      }
      dist[ny][nx] = dist[y][x] + 1;
      parent[ny][nx] = [x, y];
      queue.push([nx, ny]);
    }
  }
  return { dist, parent };
}

export function farthestCell(dist) {
  const height = dist.length;
  const width = dist[0].length;
  let max = -1;
  let cell = [0, 0];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const d = dist[y][x];
      if (d > max) {
        max = d;
        cell = [x, y];
      }
    }
  }
  return { cell, distance: max };
}

export function reconstructPath(parent, start, goal) {
  const path = [];
  let current = goal;
  while (current) {
    path.push(current);
    if (current[0] === start[0] && current[1] === start[1]) {
      break;
    }
    current = parent[current[1]][current[0]];
  }
  path.reverse();
  return path;
}

export function bfsPathLength(grid, start, goal) {
  const { dist } = bfs(grid, start);
  return dist[goal[1]][goal[0]];
}
