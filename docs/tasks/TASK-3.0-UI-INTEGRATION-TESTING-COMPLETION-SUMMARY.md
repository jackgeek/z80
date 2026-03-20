# Task 3.0 — UI Integration & Testing — Completion Summary

## What was implemented

- **Save State button** added to `src/index.html` toolbar (next to Reset button)
- **Load button** label updated to "Load TAP / TZX / Z80", accept attribute includes `.z80`
- **Button wiring** in `src/main.js`: Save button calls `saveZ80()`
- **Version bumped** to 1.0.17 (package.json + src/index.html)
- **CLAUDE.md** updated with snapshot save/restore in Key Conventions
- **assembly/docs/CLAUDE.md** updated with getter/setter export documentation

## Testing notes

Manual testing required in browser:
1. Load a TAP game, let it run, click "Save State" → should download `snapshot.z80`
2. Drag the saved `.z80` file back into the emulator → game should resume exactly
3. Try loading `.z80` files from other emulators (Fuse, ZXSpin) for interop testing

## Files modified

| File | Changes |
|------|---------|
| `src/index.html` | Added Save State button, updated Load label, bumped version to 1.0.17 |
| `src/main.js` | Added save-btn click handler |
| `package.json` | Bumped version to 1.0.17 |
| `CLAUDE.md` | Added snapshot save/restore to Key Conventions |
