import { getWasm } from '../emulator/state.js';

// Types: J  SYMBOL+P  SYMBOL+P  ENTER
// (i.e. LOAD "" then Enter — standard 48K BASIC tape loader)
export function typeLoadAndRun(): void {
  const wasm = getWasm();
  if (!wasm) return;

  type Step = () => void;
  const steps: Step[] = [];
  const GAP = 80; // ms between each keydown/keyup

  function press(row: number, bit: number, mod?: { row: number; bit: number }): void {
    steps.push(() => {
      wasm!.keyDown(row, bit);
      if (mod) wasm!.keyDown(mod.row, mod.bit);
    });
    steps.push(() => {
      wasm!.keyUp(row, bit);
      if (mod) wasm!.keyUp(mod.row, mod.bit);
    });
  }

  // J
  press(6, 0x08);
  // SYMBOL+P (opening ")
  press(5, 0x01, { row: 7, bit: 0x02 });
  // SYMBOL+P (closing ")
  press(5, 0x01, { row: 7, bit: 0x02 });
  // ENTER
  press(6, 0x01);

  steps.forEach((step, i) => setTimeout(step, i * GAP));
}
