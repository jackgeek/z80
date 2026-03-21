// ZX Spectrum 48K Emulator — Entry Point
// Imports all modules and wires them together.

import { initWasm } from './emulator/wasm-loader.js';
import { initScreen } from './video/screen.js';
import { attachKeyboardHandlers } from './input/keyboard.js';
import { initVirtualKeyboard } from './input/vkeyboard.js';
import { initJoystick } from './input/joystick.js';
import { initCube } from './video/cube.js';
import { initUI } from './ui/ui.js';

// Initialize screen rendering (WebGL/Canvas2D setup)
initScreen();

// Attach physical keyboard handlers
attachKeyboardHandlers();

// Build virtual ZX Spectrum keyboard
initVirtualKeyboard();

// Set up fullscreen + touch joystick
initJoystick();

// Initialize Three.js 3D cube visualization
initCube();

// Wire up UI buttons, drag-and-drop, file inputs
initUI();

// Load WASM, ROM, and start the frame loop
initWasm();
