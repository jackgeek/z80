# Task 2.0 — .z80 Format Save & Load — Completion Summary

## What was implemented

Added .z80 snapshot save and load to `src/main.js`:

- **`compressZ80Page(data)`** — ED ED RLE compression for 16 KB pages
- **`decompressZ80(data, expectedLength)`** — ED ED RLE decompression supporting v1/v2/v3
- **`saveZ80()`** — Saves full machine state as .z80 v3 format, triggers browser download
- **`loadZ80(arrayBuffer)`** — Loads .z80 files (v1, v2, v3), restores all registers + 48 KB RAM
- **File handler integration** — .z80 extension detected in both drag-drop and Load button handlers

## Format versions supported

- **Save**: v3 (30-byte header + 56-byte extended header + 3 compressed pages)
- **Load**: v1 (PC≠0, compressed or raw RAM), v2 (extLen=23), v3 (extLen=54/55)

## Compression details

- ED ED RLE: `ED ED count byte` for runs of 2+ identical bytes
- Single ED bytes encoded as `ED ED 01 ED` to avoid ambiguity
- Three 16 KB pages for 48K Spectrum: page 8 (0x4000), page 4 (0x8000), page 5 (0xC000)

## Files modified

| File | Changes |
|------|---------|
| `src/main.js` | Added compressZ80Page, decompressZ80, saveZ80, loadZ80; .z80 detection in drop handler and tap-input handler; Save button wiring |
