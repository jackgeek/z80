// ZX Spectrum TAP file generator
// CommonJS module

/**
 * Encode an integer (0-65535) as a 5-byte Spectrum floating point "small integer".
 */
function float5(value) {
  return [0x00, 0x00, value & 0xFF, (value >> 8) & 0xFF, 0x00];
}

/**
 * Push ASCII digit characters for a decimal number, followed by 0x0E and the 5-byte float.
 */
function pushNumber(tokens, value) {
  const digits = String(value);
  for (let i = 0; i < digits.length; i++) {
    tokens.push(digits.charCodeAt(i));
  }
  tokens.push(0x0E);
  tokens.push(...float5(value));
}

/**
 * Build the tokenized BASIC loader program.
 */
function buildBasicLoader(loadAddress, autorun) {
  const tokens = [];

  // CLEAR {org-1}
  tokens.push(0xFD); // CLEAR
  tokens.push(0x20); // space
  pushNumber(tokens, loadAddress - 1);

  // :
  tokens.push(0x3A);

  // LOAD "" CODE
  tokens.push(0xEF); // LOAD
  tokens.push(0x22); // "
  tokens.push(0x22); // "
  tokens.push(0xAF); // CODE

  // If autorun: : RANDOMIZE USR {org}
  if (autorun) {
    tokens.push(0x3A); // :
    tokens.push(0xF9); // RANDOMIZE
    tokens.push(0x20); // space
    tokens.push(0xC0); // USR
    tokens.push(0x20); // space
    pushNumber(tokens, loadAddress);
  }

  // End of line
  tokens.push(0x0D);

  // Build the full BASIC line: line number (BE) + line length (LE) + tokens
  const lineNumber = 10;
  const lineLength = tokens.length;
  const line = Buffer.alloc(4 + lineLength);
  line.writeUInt16BE(lineNumber, 0);
  line.writeUInt16LE(lineLength, 2);
  Buffer.from(tokens).copy(line, 4);

  return line;
}

/**
 * Create a TAP block: [2-byte LE length] [flag] [data...] [checksum]
 */
function tapBlock(flag, data) {
  const blockLength = 1 + data.length + 1; // flag + data + checksum
  let checksum = flag;
  for (let i = 0; i < data.length; i++) {
    checksum ^= data[i];
  }
  const buf = Buffer.alloc(2 + blockLength);
  buf.writeUInt16LE(blockLength, 0);
  buf[2] = flag;
  data.copy ? data.copy(buf, 3) : Buffer.from(data).copy(buf, 3);
  buf[buf.length - 1] = checksum & 0xFF;
  return buf;
}

/**
 * Build a 17-byte header data payload.
 */
function headerData(type, name, dataLength, param1, param2) {
  const buf = Buffer.alloc(17);
  buf[0] = type;

  // Name: 10 chars, space-padded
  const padded = (name + '          ').slice(0, 10);
  for (let i = 0; i < 10; i++) {
    buf[1 + i] = padded.charCodeAt(i);
  }

  buf.writeUInt16LE(dataLength, 11);
  buf.writeUInt16LE(param1, 13);
  buf.writeUInt16LE(param2, 15);
  return buf;
}

/**
 * Generate a complete TAP file containing a BASIC loader and a code block.
 *
 * @param {Buffer} binary - Assembled machine code bytes
 * @param {number} loadAddress - Memory address where code loads (e.g. 0x8000)
 * @param {string} name - Program name (max 10 chars, padded with spaces)
 * @param {boolean} autorun - If true, the BASIC loader auto-executes with RANDOMIZE USR
 * @returns {Buffer} Complete valid TAP file
 */
function generateTAP(binary, loadAddress, name, autorun) {
  const basicData = buildBasicLoader(loadAddress, autorun);
  const basicLength = basicData.length;

  const autostartLine = autorun ? 10 : 0x8000;

  // Block 1: BASIC program header
  const block1 = tapBlock(0x00, headerData(0x00, name, basicLength, autostartLine, basicLength));

  // Block 2: BASIC program data
  const block2 = tapBlock(0xFF, basicData);

  // Block 3: Code header
  const block3 = tapBlock(0x00, headerData(0x03, name, binary.length, loadAddress, 0x8000));

  // Block 4: Code data
  const block4 = tapBlock(0xFF, binary);

  return Buffer.concat([block1, block2, block3, block4]);
}

module.exports = { generateTAP };
