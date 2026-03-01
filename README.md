# Rubik's Cube (Vite + TypeScript + Three.js)

A Vite + TypeScript app that renders a fully turnable **3x3 Rubik's cube** with **27 cubies** in Three.js, plus solver integration via `cubejs`.

## Features

- 3D cube rendered as 27 cubies, each with face colors.
- Face moves: `U D L R F B` with modifiers `'` and `2`.
- Animated turns implemented with a temporary pivot `Object3D`, then re-parent + snap to integer grid.
- Parallel logical model (`CubeState`) that tracks cubie positions/stickers and exports facelet strings for `cubejs`.
- UI actions:
  - **Scramble**: 25 random moves (never repeats same face consecutively), animates and shows text.
  - **Solve**: exports current state -> solves with `cubejs` -> animates solution moves.
  - **Reset**: returns to solved state.
- Orbit controls (mouse drag) with text selection disabled during drag.

## Run

```bash
npm install
npm run dev
```

Open the shown local Vite URL in your browser.

## Build

```bash
npm run build
```

## Project Structure

- `src/cube.ts`: cube state model + move parsing + facelet export + scramble generator.
- `src/rubiksScene.ts`: Three.js scene, cubie meshes, animated pivot turns, orbit controls.
- `src/App.tsx`: UI and integration between renderer, cube state, scramble, and solver.
