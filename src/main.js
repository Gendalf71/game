import { resizeCanvas, renderGame, renderMenu } from "./render.js";
import { randomSeed, normalizeSeed } from "./prng.js";
import { generateRecursiveDivision } from "./maze/variant1_recursiveDivision.js";
import { generateHierarchical } from "./maze/variant2_hierarchical.js";
import { generateFbmCaves } from "./maze/variant3_fbmCaves.js";
import { bfsPathLength } from "./pathfinding.js";

const TILE_SIZE = 12;
const GRID_WIDTH = 101;
const GRID_HEIGHT = 57;
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const PLAYER_SPEED = 120;
const PLAYER_SIZE = 8;

const VARIANTS = {
  1: { name: "Recursive Division", generator: generateRecursiveDivision },
  2: { name: "Hierarchical Macro/Micro", generator: generateHierarchical },
  3: { name: "fBm Caves", generator: generateFbmCaves },
};

const PRESET_NAMES = ["A", "B", "C"];

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
resizeCanvas(canvas, CANVAS_WIDTH, CANVAS_HEIGHT);
window.addEventListener("resize", () => resizeCanvas(canvas, CANVAS_WIDTH, CANVAS_HEIGHT));

const seedInput = document.querySelector("#seedInput");
const seedButton = document.querySelector("#seedButton");
const presetSelect = document.querySelector("#presetSelect");
const variantLabel = document.querySelector("#variantLabel");

let state = "menu";
let activeVariant = 1;
let activePreset = "A";
let seed = randomSeed();
let grid = null;
let start = null;
let exit = null;
let stats = {};
let debugEnabled = false;
let victory = null;
let startTime = 0;
let lastTime = performance.now();
let player = { x: 0, y: 0, size: PLAYER_SIZE };
const keys = new Set();

function updateVariantLabel() {
  variantLabel.textContent = `${activeVariant} — ${VARIANTS[activeVariant].name}`;
}

function parseSeedInput() {
  const value = seedInput.value.trim();
  if (value.length === 0) {
    return null;
  }
  if (value.startsWith("0x") || value.startsWith("0X")) {
    return normalizeSeed(parseInt(value, 16));
  }
  return normalizeSeed(parseInt(value, 10));
}

function validateMaze(currentGrid, startCell, exitCell) {
  const height = currentGrid.length;
  const width = currentGrid[0].length;
  for (let x = 0; x < width; x += 1) {
    if (currentGrid[0][x] !== 1 || currentGrid[height - 1][x] !== 1) {
      return { ok: false, reason: "border" };
    }
  }
  for (let y = 0; y < height; y += 1) {
    if (currentGrid[y][0] !== 1 || currentGrid[y][width - 1] !== 1) {
      return { ok: false, reason: "border" };
    }
  }
  if (!startCell || !exitCell) {
    return { ok: false, reason: "missing start/exit" };
  }
  if (currentGrid[startCell[1]][startCell[0]] === 1 || currentGrid[exitCell[1]][exitCell[0]] === 1) {
    return { ok: false, reason: "start/exit on wall" };
  }
  const pathLength = bfsPathLength(currentGrid, startCell, exitCell);
  if (pathLength < 0) {
    return { ok: false, reason: "exit unreachable" };
  }
  return { ok: true, pathLength };
}

function generateMaze(newSeed, presetOverride) {
  const preset = presetOverride || activePreset;
  const variant = VARIANTS[activeVariant];
  const result = variant.generator({
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    seed: newSeed,
    presetName: preset,
  });
  grid = result.grid;
  start = result.start;
  exit = result.exit;
  stats = { ...result.stats, pathLength: result.pathLength };
  seed = result.seed ?? newSeed;
  activePreset = result.preset || preset;
  player = {
    x: start[0] * TILE_SIZE + TILE_SIZE / 2,
    y: start[1] * TILE_SIZE + TILE_SIZE / 2,
    size: PLAYER_SIZE,
  };
  startTime = performance.now();
  victory = null;

  const validation = validateMaze(grid, start, exit);
  if (!validation.ok) {
    console.warn("Maze validation failed", validation.reason);
  }
}

function handleMovement(dt) {
  if (!grid || victory) {
    return;
  }
  let dx = 0;
  let dy = 0;
  if (keys.has("ArrowUp") || keys.has("KeyW")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) dy += 1;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) dx += 1;
  if (dx === 0 && dy === 0) {
    return;
  }
  const length = Math.hypot(dx, dy) || 1;
  dx = (dx / length) * PLAYER_SPEED * dt;
  dy = (dy / length) * PLAYER_SPEED * dt;
  movePlayer(dx, 0);
  movePlayer(0, dy);
}

function collides(x, y) {
  const half = PLAYER_SIZE / 2;
  const left = x - half;
  const right = x + half;
  const top = y - half;
  const bottom = y + half;
  const minX = Math.floor(left / TILE_SIZE);
  const maxX = Math.floor(right / TILE_SIZE);
  const minY = Math.floor(top / TILE_SIZE);
  const maxY = Math.floor(bottom / TILE_SIZE);
  for (let ty = minY; ty <= maxY; ty += 1) {
    for (let tx = minX; tx <= maxX; tx += 1) {
      if (grid[ty] && grid[ty][tx] === 1) {
        return true;
      }
    }
  }
  return false;
}

function movePlayer(dx, dy) {
  const nextX = player.x + dx;
  const nextY = player.y + dy;
  if (!collides(nextX, nextY)) {
    player.x = nextX;
    player.y = nextY;
  }
}

function checkVictory() {
  if (victory) {
    return;
  }
  const tileX = Math.floor(player.x / TILE_SIZE);
  const tileY = Math.floor(player.y / TILE_SIZE);
  if (tileX === exit[0] && tileY === exit[1]) {
    victory = {
      time: (performance.now() - startTime) / 1000,
    };
  }
}

function buildHud() {
  const elapsed = (performance.now() - startTime) / 1000;
  return {
    title: `Variant ${activeVariant} (${activePreset}) | Seed ${seed}`,
    subtitle: `Время: ${elapsed.toFixed(2)} сек`,
    controls: "WASD/Стрелки: движение | R: новый seed | Enter: повтор | C: debug",
  };
}

function buildDebugLines() {
  const lines = [
    `Seed: ${seed}`,
    `Variant: ${activeVariant} (${activePreset})`,
    `Path length: ${stats.pathLength ?? "?"}`,
  ];
  if (activeVariant === 1) {
    lines.push(`Max depth: ${stats.maxDepth}`);
    lines.push(`Walls placed: ${stats.wallsPlaced}`);
    lines.push(`Doors total: ${stats.doorCountTotal}`);
    lines.push(`Open %: ${(stats.openPct * 100).toFixed(1)}%`);
  }
  if (activeVariant === 2) {
    lines.push(`Macro edges: ${stats.macroEdgesCount}`);
    lines.push(`Doors between blocks: ${stats.doorsPlacedBetweenBlocks}`);
    lines.push(`Micro loops added: ${stats.microLoopsAdded}`);
    lines.push(`Open %: ${(stats.openPct * 100).toFixed(1)}%`);
  }
  if (activeVariant === 3) {
    lines.push(`Scale: ${stats.scale} T=${stats.threshold}`);
    lines.push(`Octaves: ${stats.octaves}`);
    lines.push(`Largest component: ${stats.largestComponentSize}`);
    lines.push(`Open before/after: ${(stats.openPctBefore * 100).toFixed(1)}% / ${(stats.openPctAfter * 100).toFixed(1)}%`);
    lines.push(`Branches: ${stats.branchCount}, avg len ${stats.avgBranchLen.toFixed(1)}`);
    lines.push(`Smoothing: ${stats.smoothingApplied}`);
  }
  return lines;
}

function loop(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;
  if (state === "menu") {
    renderMenu(ctx, "Лабиринты: выберите вариант", [
      "1 — Recursive Division",
      "2 — Macro/Micro Labyrinth",
      "3 — fBm Caves",
      "C — Debug, R — random seed, Enter — repeat",
    ]);
  } else if (state === "playing") {
    handleMovement(dt);
    checkVictory();
    renderGame(ctx, {
      grid,
      tileSize: TILE_SIZE,
      player,
      start,
      exit,
      hud: buildHud(),
      debug: { enabled: debugEnabled, lines: buildDebugLines() },
      victory,
    });
  }
  requestAnimationFrame(loop);
}

function startGame(newSeed) {
  generateMaze(newSeed);
  state = "playing";
}

function setVariant(newVariant) {
  activeVariant = newVariant;
  updateVariantLabel();
  startGame(seed);
}

seedButton.addEventListener("click", () => {
  const parsed = parseSeedInput();
  if (parsed !== null) {
    seed = parsed;
    startGame(seed);
  }
});

presetSelect.addEventListener("change", (event) => {
  activePreset = event.target.value;
  startGame(seed);
});

window.addEventListener("keydown", (event) => {
  if (event.code === "KeyC") {
    debugEnabled = !debugEnabled;
    return;
  }
  if (state === "menu") {
    if (event.code === "Digit1") {
      setVariant(1);
      return;
    }
    if (event.code === "Digit2") {
      setVariant(2);
      return;
    }
    if (event.code === "Digit3") {
      setVariant(3);
      return;
    }
    if (event.code === "KeyR") {
      seed = randomSeed();
      startGame(seed);
    }
    if (event.code === "Enter") {
      startGame(seed);
    }
    return;
  }

  if (event.code === "KeyR") {
    seed = randomSeed();
    seedInput.value = seed.toString(10);
    startGame(seed);
    return;
  }
  if (event.code === "Enter") {
    startGame(seed);
    return;
  }
  if (event.code === "Digit1") {
    setVariant(1);
    return;
  }
  if (event.code === "Digit2") {
    setVariant(2);
    return;
  }
  if (event.code === "Digit3") {
    setVariant(3);
    return;
  }
  keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

function initPresetSelect() {
  presetSelect.innerHTML = "";
  for (const preset of PRESET_NAMES) {
    const option = document.createElement("option");
    option.value = preset;
    option.textContent = `Preset ${preset}`;
    presetSelect.appendChild(option);
  }
  presetSelect.value = activePreset;
}

function maybeRunTests() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("test") !== "1") {
    return false;
  }
  state = "test";
  const pre = document.querySelector("#testlog");
  pre.classList.remove("hidden");
  import("../tests/runGoldenTests.js").then((module) => {
    module.runGoldenTests(pre);
  });
  return true;
}

initPresetSelect();
updateVariantLabel();
seedInput.value = seed.toString(10);

if (!maybeRunTests()) {
  requestAnimationFrame(loop);
}

