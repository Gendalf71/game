import { generateRecursiveDivision } from "../src/maze/variant1_recursiveDivision.js";
import { generateHierarchical } from "../src/maze/variant2_hierarchical.js";
import { generateFbmCaves } from "../src/maze/variant3_fbmCaves.js";
import { bfsPathLength } from "../src/pathfinding.js";

const VARIANT_MAP = {
  1: generateRecursiveDivision,
  2: generateHierarchical,
  3: generateFbmCaves,
};

export async function loadGoldenJson() {
  const response = await fetch("tests/golden.json");
  if (!response.ok) {
    throw new Error(`Failed to load golden.json: ${response.status}`);
  }
  return response.json();
}

export function computeOpenPct(grid) {
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

export function fnv1a32GridHash(grid) {
  let hash = 2166136261;
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[0].length; x += 1) {
      const value = grid[y][x] === 1 ? 0x01 : 0x00;
      hash ^= value;
      hash = Math.imul(hash, 16777619) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, "0");
}

export function generateCase({ variant, preset, seed, gridSize }) {
  const generator = VARIANT_MAP[variant];
  const result = generator({
    width: gridSize.w,
    height: gridSize.h,
    seed,
    presetName: preset,
  });
  return {
    grid: result.grid,
    start: result.start,
    exit: result.exit,
  };
}

export function runGoldenTestsForCase(caseData, gridSize) {
  const { grid, start, exit } = generateCase({
    variant: caseData.variant,
    preset: caseData.preset,
    seed: caseData.seed,
    gridSize,
  });
  const openPct = computeOpenPct(grid);
  const gridHash = fnv1a32GridHash(grid);
  const pathLength = bfsPathLength(grid, start, exit);
  const diffs = [];
  const expected = caseData.expected;

  const comparePair = (label, actual, expectedValue) => {
    if (expectedValue === null || expectedValue === undefined) {
      return;
    }
    if (Array.isArray(expectedValue)) {
      if (expectedValue[0] !== actual[0] || expectedValue[1] !== actual[1]) {
        diffs.push(`${label} expected [${expectedValue}] got [${actual}]`);
      }
      return;
    }
    if (typeof expectedValue === "number" && label === "openPct") {
      if (Math.abs(expectedValue - actual) > 0.0001) {
        diffs.push(`${label} expected ${expectedValue} got ${actual}`);
      }
      return;
    }
    if (expectedValue !== actual) {
      diffs.push(`${label} expected ${expectedValue} got ${actual}`);
    }
  };

  comparePair("start", start, expected.start);
  comparePair("exit", exit, expected.exit);
  comparePair("gridHash", gridHash, expected.gridHash);
  comparePair("pathLength", pathLength, expected.pathLength);
  comparePair("openPct", Number(openPct.toFixed(4)), expected.openPct);

  return {
    id: caseData.id,
    pass: diffs.length === 0,
    diffs,
    actual: {
      start,
      exit,
      gridHash,
      openPct: Number(openPct.toFixed(4)),
      pathLength,
    },
  };
}

export async function runGoldenTests(outputElement) {
  outputElement.textContent = "";
  let golden;
  try {
    golden = await loadGoldenJson();
  } catch (error) {
    outputElement.textContent = `Failed to load golden.json: ${error.message}`;
    return;
  }
  const results = golden.cases.map((caseData) =>
    runGoldenTestsForCase(caseData, golden.grid)
  );
  const lines = [];
  let passCount = 0;
  for (const result of results) {
    if (result.pass) {
      passCount += 1;
      lines.push(`PASS ${result.id}`);
    } else {
      lines.push(`FAIL ${result.id}`);
      lines.push(...result.diffs.map((diff) => `  - ${diff}`));
      lines.push(
        `  actual: start=${JSON.stringify(result.actual.start)} exit=${JSON.stringify(
          result.actual.exit
        )} hash=${result.actual.gridHash} openPct=${result.actual.openPct} path=${result.actual.pathLength}`
      );
    }
  }
  lines.push(`\nSummary: ${passCount}/${results.length} passed.`);
  outputElement.textContent = lines.join("\n");
}

