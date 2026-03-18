# Getting Started

## Prerequisites

- Node.js 20+
- npm

## Install

```bash
npm ci
```

This installs AssemblyScript (the only dependency).

## Build

```bash
npm run build
```

Compiles `assembly/index.ts` to `build/spectrum.wasm` and copies it to `src/spectrum.wasm`.

Key compiler flags:
- `--runtime stub` — minimal runtime (no GC)
- `--optimizeLevel 3` — aggressive optimization
- `--importMemory --initialMemory 256 --maximumMemory 256` — fixed 16 MB shared memory

## Run

```bash
npm run serve
```

Starts `http-server` on `localhost:8080` serving the `src/` directory.

Or use the combined command:

```bash
npm run dev    # build + serve
```

## Dev Workflow

1. Edit `assembly/index.ts` (WASM core) or files in `src/` (frontend)
2. Run `npm run build` if you changed the AssemblyScript
3. Refresh the browser (frontend JS changes don't need a build step)

The `src/` directory is the complete deployable site. There's no bundler or transpiler for the JS files.

## Loading Software

Drag and drop `.tap`, `.tzx`, or `.zip` files onto the emulator, or use the file picker. ZIP files are auto-extracted (first `.tap`/`.tzx` found inside).

## Deployment

Pushes to `main` auto-deploy to GitHub Pages via `.github/workflows/deploy.yml`. The workflow runs `npm run build` and publishes the `src/` directory.
