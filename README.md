# Maze Variants Game

Browser-based maze game with three deterministic generators and golden regression tests.

## Run

Use any static file server from the repo root:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Controls

- **WASD / Arrow keys**: move
- **R**: regenerate with a new seed
- **Enter**: regenerate with the same seed
- **C**: toggle debug
- **1 / 2 / 3**: switch generator variant

## Variants

1. **Recursive Division** — architectural fractal division with door rules and recursion stats.
2. **Hierarchical Macro/Micro** — macro spanning tree with micro DFS mazes per block.
3. **fBm Caves** — value-noise fBm caves with a carved main corridor and branches.

Presets **A/B/C** are available in the UI (top bar).

## Test mode (golden regression)

Open the game with `?test=1` to run golden tests:

```
http://localhost:8080/?test=1
```

The results render in a `<pre>` block and compare grid hash, open percentage, start/exit, and path length.

## Project structure

```
index.html
style.css
src/main.js
src/render.js
src/maze/variant1_recursiveDivision.js
src/maze/variant2_hierarchical.js
src/maze/variant3_fbmCaves.js
src/prng.js
src/pathfinding.js
tests/golden.json
tests/runGoldenTests.js
```
