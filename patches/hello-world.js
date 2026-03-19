/**
 * Hello World ROM Patch
 *
 * Injects a built-in BASIC program into the ZX Spectrum 48K ROM so that
 * after boot, typing RUN displays "Hello World!".
 *
 * The program is: 10 PRINT "Hello World!"
 *
 * How it works:
 *   The ROM init at 0x1249-0x1264 sets up memory pointers (PROG, VARS,
 *   E_LINE, WORKSP, STKBOT, STKEND) with an empty program. We hook at
 *   0x124A (LD (0x5C53), HL — storing PROG) by replacing it with a JP
 *   to our patch code in the ROM's free space (0x386E-0x3CFF).
 *
 *   Our patch code:
 *   1. Stores PROG (the original instruction we replaced)
 *   2. Copies the BASIC line from ROM into RAM at the PROG address
 *   3. Advances HL past the program
 *   4. Jumps back to 0x124D where the original init continues,
 *      setting VARS = HL (now past program), E_LINE, etc.
 *
 * BASIC line format (ZX Spectrum):
 *   [line_hi] [line_lo] [len_lo] [len_hi] [tokens...] [0x0D]
 *
 *   10 PRINT "Hello World!"
 *   = 00 0A 10 00 F5 22 48 65 6C 6C 6F 20 57 6F 72 6C 64 21 22 0D
 *     ^^^^^ ^^^^^ ^^ ^^                                        ^^
 *     line   len   PRINT "    H  e  l  l  o     W  o  r  l  d  !  "  CR
 */

module.exports = {
  name: 'Hello World',
  description: 'Built-in BASIC program: 10 PRINT "Hello World!" — type RUN after boot',
  output: 'src/custom.rom',

  patches: [
    // Hook: replace LD (0x5C53), HL at 0x124A with JP 0x386E
    {
      address: 0x124A,
      bytes: [0xC3, 0x6E, 0x38]  // JP 0x386E
    },

    // Patch code + data in free ROM space
    {
      asm: `
        .org 0x386E

        ; --- Patch entry point (called from init at 0x124A) ---
        ; HL = address that should become PROG (set by init code before us)

        ; Execute the original instruction we overwrote
        LD (0x5C53), HL       ; PROG = HL

        ; Copy BASIC program from ROM to RAM at PROG
        EX DE, HL             ; DE = PROG (LDIR destination)
        LD HL, basic_line     ; HL = source data in ROM
        LD BC, basic_line_end - basic_line  ; length
        LDIR                  ; copy to RAM

        ; DE now points past the copied data in RAM
        EX DE, HL             ; HL = first byte after program in RAM

        ; Jump back to init — it will set VARS=HL, write end markers, etc.
        JP 0x124D

        ; --- BASIC program data ---
        ; Line 10: PRINT "Hello World!"
      basic_line:
        DB 0x00, 0x0A         ; line number 10 (big-endian)
        DB 0x10, 0x00         ; text length = 16 (little-endian)
        DB 0xF5               ; PRINT token
        DB 0x22               ; opening quote
        DB "Hello World!"     ; 12 bytes of text
        DB 0x22               ; closing quote
        DB 0x0D               ; end of line
      basic_line_end:
      `
    }
  ]
};
