; hello.asm — Print "Hello, World!" on the ZX Spectrum
; Uses ROM routine RST 0x10 (PRINT-A) to output characters
; The ROM must set up the channel first via CHAN-OPEN (0x1601)

        ORG $8000

start:
        call $0DAF          ; CLS: clear the screen

        ld a, 2             ; Channel 2 = main screen
        call $1601          ; CHAN-OPEN: open channel for output

        ld hl, message      ; Point HL to our message string
.loop:
        ld a, (hl)          ; Load next character
        or a                ; Test if zero (end of string)
        jr z, .done         ; If zero, we're done
        rst $10             ; PRINT-A: print character in A
        inc hl              ; Move to next character
        jr .loop            ; Repeat

.done:
        ret                 ; Return to BASIC

message:
        db "Hello, World!", 0
