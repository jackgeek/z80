// ZX Spectrum 48K keyboard layout data — pure data, no side effects

export interface VKeyDef {
  label: string;
  sym?: string;
  sub?: string;
  ext?: string;
  color?: string;
  colorHex?: string;
  row: number;
  bit: number;
  wide?: number;
  sticky?: boolean;
  id?: string;
}

export const ROWS: VKeyDef[][] = [
  [
    { label:'1', sym:'!',  sub:'EDIT',      ext:'DEF FN', color:'BLUE',    colorHex:'#1818f0', row:3, bit:0x01 },
    { label:'2', sym:'@',  sub:'CAPS LOCK', ext:'FN',     color:'RED',     colorHex:'#d80000', row:3, bit:0x02 },
    { label:'3', sym:'#',  sub:'TRUE\nVIDEO',ext:'LINE',  color:'MAGENTA', colorHex:'#d800d8', row:3, bit:0x04 },
    { label:'4', sym:'$',  sub:'INV\nVIDEO',ext:'OPEN #', color:'GREEN',   colorHex:'#00d800', row:3, bit:0x08 },
    { label:'5', sym:'%',  sub:'←',        ext:'CLOSE #',color:'CYAN',    colorHex:'#00d8d8', row:3, bit:0x10 },
    { label:'6', sym:'&',  sub:'↓',        ext:'MOVE',   color:'YELLOW',  colorHex:'#d8d800', row:4, bit:0x10 },
    { label:'7', sym:"'",  sub:'↑',        ext:'ERASE',  color:'WHITE',   colorHex:'#d8d8d8', row:4, bit:0x08 },
    { label:'8', sym:'(',  sub:'→',        ext:'POINT',  color:'',        colorHex:'',         row:4, bit:0x04 },
    { label:'9', sym:')',  sub:'GRAPHICS', ext:'TAG',    color:'',        colorHex:'',         row:4, bit:0x02 },
    { label:'0', sym:'_',  sub:'DELETE',   ext:'FORMAT', color:'BLACK',   colorHex:'#686868', row:4, bit:0x01 },
  ],
  [
    { label:'Q', sym:'<=', sub:'PLOT',   ext:'SIN',    row:2, bit:0x01 },
    { label:'W', sym:'<>', sub:'DRAW',   ext:'COS',    row:2, bit:0x02 },
    { label:'E', sym:'>=', sub:'REM',    ext:'TAN',    row:2, bit:0x04 },
    { label:'R', sym:'<',  sub:'RUN',    ext:'INT',    row:2, bit:0x08 },
    { label:'T', sym:'>',  sub:'RAND',   ext:'RND',    row:2, bit:0x10 },
    { label:'Y', sym:'[',  sub:'RETURN', ext:'STR$',   row:5, bit:0x10 },
    { label:'U', sym:']',  sub:'IF',     ext:'CHR$',   row:5, bit:0x08 },
    { label:'I', sym:'↑',  sub:'INPUT',  ext:'CODE',   row:5, bit:0x04 },
    { label:'O', sym:';',  sub:'POKE',   ext:'PEEK',   row:5, bit:0x02 },
    { label:'P', sym:'"',  sub:'PRINT',  ext:'TAB',    row:5, bit:0x01 },
  ],
  [
    { label:'A', sym:'~',  sub:'NEW',    ext:'READ',   row:1, bit:0x01 },
    { label:'S', sym:'|',  sub:'SAVE',   ext:'RESTORE',row:1, bit:0x02 },
    { label:'D', sym:'\\', sub:'DIM',    ext:'DATA',   row:1, bit:0x04 },
    { label:'F', sym:'{',  sub:'FOR',    ext:'SGN',    row:1, bit:0x08 },
    { label:'G', sym:'}',  sub:'GOTO',   ext:'ABS',    row:1, bit:0x10 },
    { label:'H', sym:'^',  sub:'GOSUB',  ext:'SQR',    row:6, bit:0x10 },
    { label:'J', sym:'-',  sub:'LOAD',   ext:'VAL',    row:6, bit:0x08 },
    { label:'K', sym:'+',  sub:'LIST',   ext:'LEN',    row:6, bit:0x04 },
    { label:'L', sym:'=',  sub:'LET',    ext:'USR',    row:6, bit:0x02 },
    { label:'ENTER', row:6, bit:0x01, wide:1.8 },
  ],
  [
    { label:'CAPS\nSHIFT', row:0, bit:0x01, wide:1.8, id:'key-caps' },
    { label:'Z', sym:':',  sub:'COPY',   ext:'LN',     row:0, bit:0x02 },
    { label:'X', sym:'/',  sub:'CLEAR',  ext:'EXP',    row:0, bit:0x04 },
    { label:'C', sym:'?',  sub:'CONT',   ext:'LPRINT', row:0, bit:0x08 },
    { label:'V', sym:'/',  sub:'CLS',    ext:'LLIST',  row:0, bit:0x10 },
    { label:'B', sym:'*',  sub:'BORDER', ext:'BIN',    row:7, bit:0x10 },
    { label:'N', sym:',',  sub:'NEXT',   ext:"INKEY$", row:7, bit:0x08 },
    { label:'M', sym:'.',  sub:'PAUSE',  ext:'PI',     row:7, bit:0x04 },
    { label:'SYM\nSHIFT', row:7, bit:0x02, wide:1.8, id:'key-sym' },
    { label:'BREAK\nSPACE', row:7, bit:0x01, wide:2.2 },
  ],
];

// Maps spectrum matrix (row, bit) → key index 0–39 in the 3D keyboard model.
// Keys are ordered left-to-right, top-to-bottom matching ROWS above.
export const ROW_BIT_TO_KEY_INDEX: Record<string, number> = {};
ROWS.forEach((row, rowIdx) => {
  row.forEach((key, colIdx) => {
    ROW_BIT_TO_KEY_INDEX[`${key.row},${key.bit}`] = rowIdx * 10 + colIdx;
  });
});
