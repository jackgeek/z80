# Getting Started

## Prerequisites

- [Bun](https://bun.sh/) (package manager and script runner)
- Node.js 20+ (required by AssemblyScript compiler)

## Install

```bash
bun install
```

This installs AssemblyScript, Vite, TypeScript, and `@types/three` (dev dependencies), plus Three.js (runtime dependency).

## Build

```bash
bun run build
```

This runs two steps:
1. **`build:wasm`** — Compiles `assembly/index.ts` to `build/spectrum.wasm` and copies it to `public/spectrum.wasm`
2. **`build:web`** — Runs Vite production build, outputting to `dist/`

Key WASM compiler flags:
- `--runtime stub` — minimal runtime (no GC)
- `--optimizeLevel 3` — aggressive optimization
- `--importMemory --initialMemory 256 --maximumMemory 256` — fixed 16 MB shared memory

## Run (Development)

```bash
bun run dev
```

Builds the WASM, then starts the **Vite dev server** on `localhost:8080` with hot module replacement (HMR). Frontend TypeScript changes are reflected instantly without a manual reload.

## Run (Production Preview)

```bash
bun run serve
```

Runs `vite preview` on port 8080, serving the production build from `dist/`. You must run `bun run build` first.

## Dev Workflow

1. Edit `assembly/index.ts` (WASM core) or TypeScript files in `src/` (frontend)
2. Run `bun run build:wasm` if you changed the AssemblyScript (or use `bun run dev` which builds WASM on startup)
3. Frontend TypeScript changes are picked up automatically by Vite's dev server (HMR)

Source modules live in `src/` (organized into subdirectories: `emulator/`, `input/`, `audio/`, `video/`, `media/`, `debug/`, `ui/`). Static assets (ROM, audio worklet) live in `public/`. The production build output goes to `dist/` (gitignored).

## Loading Software

Drag and drop `.tap`, `.tzx`, or `.zip` files onto the emulator, or use the file picker. ZIP files are auto-extracted (first `.tap`/`.tzx` found inside).

## Deployment

Pushes to `main` auto-deploy to GitHub Pages via `.github/workflows/deploy.yml`. The workflow runs `bun run build` and publishes the `dist/` directory.

*Updated: 2026-03-21 - npm → bun, TypeScript migration noted*
