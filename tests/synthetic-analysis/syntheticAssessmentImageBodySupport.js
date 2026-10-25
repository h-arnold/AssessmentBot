import { deflateSync, inflateSync } from 'node:zlib';

/**
 * Deterministic valid-PNG construction and structural decoding for the
 * synthetic assessment image-body regression suites.
 *
 * @remarks
 * The generated corpus labels image artefacts as PNG, so the regression suites
 * need bodies that really are PNG bytes: the helper below emits a small valid
 * image (signature + IHDR + IDAT + IEND) built from fixed bytes, and the
 * decoder checks the signature, chunk framing, CRC checksums, the required
 * IHDR/IDAT/IEND structure, the supported 8-bit truecolour IHDR declaration,
 * and the IDAT raster inflated against the declared geometry rather than
 * trusting the `data:image/` prefix.
 */

const PNG_SIGNATURE_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const BIT_DEPTH = 8;
const COLOUR_TYPE_TRUECOLOUR = 2;
const COMPRESSION_METHOD_DEFLATE = 0;
const FILTER_METHOD_ADAPTIVE = 0;
const INTERLACE_METHOD_NONE = 0;
/** Bytes per pixel of one 8-bit truecolour (RGB) scanline. */
const BYTES_PER_TRUECOLOUR_PIXEL = 3;

/** Lazily built CRC-32 lookup table over all byte values. */
let crcTable = null;

/**
 * Builds the byte-wise CRC-32 of a byte sequence.
 *
 * @param {Uint8Array} bytes Bytes to checksum.
 * @returns {number} The CRC-32 value.
 */
function crc32(bytes) {
  if (crcTable === null) {
    crcTable = new Uint32Array(256);
    for (let byte = 0; byte < 256; byte += 1) {
      let value = byte;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      crcTable[byte] = value >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Assembles one binary PNG chunk as a Buffer.
 *
 * @param {string} type Four-character chunk type.
 * @param {Uint8Array} data Chunk data.
 * @returns {Uint8Array} Length-prefixed and CRC-checked chunk bytes.
 */
function pngChunk(type, data) {
  const prefix = Buffer.alloc(4);
  prefix.writeUint32BE(data.length);
  const typedData = Buffer.concat([Buffer.from(type, 'latin1'), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUint32BE(crc32(typedData));
  return Buffer.concat([prefix, typedData, crc]);
}

/**
 * Builds a deterministic valid PNG as a `data:image/png;base64` URL.
 *
 * @param {number} width Image width.
 * @param {number} height Image height.
 * @returns {string} A data URL whose decoded body is a structurally valid PNG.
 */
export function buildSyntheticPngDataUrl(width, height) {
  const rawScanlines = buildFixedScanlines(width, height);
  const ihdr = buildSyntheticIhdr(width, height);
  const idat = deflateSync(Buffer.from(rawScanlines));

  const image = Buffer.concat([
    Buffer.from(PNG_SIGNATURE_BYTES),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${image.toString('base64')}`;
}

/**
 * Builds the synthetic IHDR bytes for the fixed RGB geometry.
 *
 * @param {number} width Image width.
 * @param {number} height Image height.
 * @returns {Buffer} The 13-byte IHDR body.
 */
function buildSyntheticIhdr(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUint32BE(width, 0);
  ihdr.writeUint32BE(height, 4);
  ihdr[8] = BIT_DEPTH;
  ihdr[9] = COLOUR_TYPE_TRUECOLOUR;
  ihdr[10] = COMPRESSION_METHOD_DEFLATE;
  ihdr[11] = FILTER_METHOD_ADAPTIVE;
  ihdr[12] = INTERLACE_METHOD_NONE;
  return ihdr;
}

/**
 * Builds the filter-prefixed fixed raster scanlines for one geometry.
 *
 * @param {number} width Image width.
 * @param {number} height Image height.
 * @returns {number[]} Uncompressed scanline bytes.
 */
function buildFixedScanlines(width, height) {
  const rawScanlines = [];
  for (let row = 0; row < height; row += 1) {
    rawScanlines.push(0);
    for (let column = 0; column < width; column += 1) {
      rawScanlines.push((row + column) % 256, 0, 0);
    }
  }
  return rawScanlines;
}

/**
 * Builds a synthetic PNG data URL from an explicit IHDR body and IDAT payload,
 * as a test-only negative control: the payload bytes are stored verbatim (still
 * CRC-wrapped), so probes can present an image whose compressed stream is not a
 * usable deflate payload or whose decompressed raster contracts disagree with
 * the declared IHDR geometry.
 *
 * @param {Buffer} ihdr The 13-byte IHDR body to embed.
 * @param {Buffer} idat The raw IDAT payload bytes to embed.
 * @returns {string} A data URL whose decoded body is the assembled PNG.
 */
export function buildSyntheticPngDataUrlFromIdat(ihdr, idat) {
  const image = Buffer.concat([
    Buffer.from(PNG_SIGNATURE_BYTES),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${image.toString('base64')}`;
}

/**
 * Decodes an image data URL and structurally validates the PNG body: it must
 * carry the PNG signature, length-correct chunks with matching CRC checksums,
 * a leading IHDR with a usable geometry, an IDAT data chunk, and a closing
 * IEND, so an image consumer can really load it.
 *
 * @remarks The body check is independent of the production encoder: the IDAT
 * stream is inflated with Node's zlib and the decompressed raster length is
 * checked against the declared IHDR geometry (8-bit, truecolour, non-interlaced
 * frames), so a CRC-correct but non-decodable or dimension-mismatched body
 * cannot pass.
 *
 * @param {string} dataUrl Claimed image data URL to decode.
 * @param {string} label Failure-message context.
 * @returns {void} Throws a labelled error when the body is not a usable PNG.
 */
export function assertDecodablePngDataUrl(dataUrl, label) {
  const failWith = (detail) => {
    throw new Error(`${label} is not a decodable PNG: ${detail}.`);
  };
  const chunks = decodePngChunks(dataUrl, label, failWith);
  const ihdr = checkPngIhdr(chunks, failWith);
  const raster = inflatePngRaster(chunks, failWith);
  const rowLength = 1 + ihdr.width * BYTES_PER_TRUECOLOUR_PIXEL;
  const expectedLength = ihdr.height * rowLength;
  if (raster.length !== expectedLength) {
    failWith(
      `the decompressed raster length ${raster.length} does not match the IHDR geometry ${ihdr.width}x${ihdr.height} at 8-bit truecolour (expected ${expectedLength} filter-prefixed bytes)`
    );
  }
  for (let row = 0; row < ihdr.height; row += 1) {
    const filterByte = raster[row * rowLength];
    if (filterByte > 4) {
      failWith(`scanline ${row} carries an unusable filter byte ${filterByte}`);
    }
  }
}

/**
 * Slices the base64 PNG body into length-checked, CRC-checked chunks.
 *
 * @param {string} dataUrl Claimed image data URL.
 * @param {string} label Failure-message context.
 * @param {(detail: string) => void} failWith Labelled failure reporter.
 * @returns {Array<{type: string, length: number, body: Buffer}>} Chunk frames.
 */
function decodePngChunks(dataUrl, label, failWith) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
    failWith('the body is not an image/png base64 data URL');
  }
  const bytes = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
  if (
    bytes.length < PNG_SIGNATURE_BYTES.length ||
    [...PNG_SIGNATURE_BYTES].some((byte, index) => bytes[index] !== byte)
  ) {
    failWith('the decoded body lacks the PNG signature');
  }
  let cursor = PNG_SIGNATURE_BYTES.length;
  /** @type {Array<{type: string, length: number, body: Buffer}>} */
  const chunks = [];
  while (cursor < bytes.length) {
    if (cursor + 8 > bytes.length) failWith('a chunk header runs past the body end');
    const length = bytes.readUint32BE(cursor);
    const type = bytes.subarray(cursor + 4, cursor + 8).toString('latin1');
    if (cursor + 12 + length > bytes.length) failWith(`chunk "${type}" runs past the body end`);
    const body = bytes.subarray(cursor + 8, cursor + 8 + length);
    const crcRange = bytes.subarray(cursor + 4, cursor + 8 + length);
    const statedCrc = bytes.readUint32BE(cursor + 8 + length);
    if (crc32(crcRange) !== statedCrc) failWith(`chunk "${type}" fails its CRC checksum`);
    if (chunks.length === 0 && type !== 'IHDR') failWith(`the first chunk is "${type}", not IHDR`);
    chunks.push({ type, length, body: Buffer.from(body) });
    cursor += 12 + length;
  }
  if (chunks.at(-1).type !== 'IEND') failWith('the body lacks a closing IEND');
  if (!chunks.some((chunk) => chunk.type === 'IDAT')) {
    failWith('the body carries no IDAT image data');
  }
  return chunks;
}

/**
 * Reads one IHDR chunk and checks its supported safe geometry declaration.
 *
 * @param {Array<{type: string, length: number, body: Buffer}>} chunks Chunk frames.
 * @param {(detail: string) => void} failWith Labelled failure reporter.
 * @returns {{width: number, height: number}} Usable image geometry.
 */
function checkPngIhdr(chunks, failWith) {
  const ihdrChunk = chunks[0];
  if (ihdrChunk.length !== 13) failWith(`the IHDR chunk is ${ihdrChunk.length} bytes, not 13`);
  const ihdr = ihdrChunk.body;
  const width = ihdr.readUint32BE(0);
  const height = ihdr.readUint32BE(4);
  if (width === 0 || height === 0) {
    failWith(`the IHDR declares the unusable image geometry ${width}x${height}`);
  }
  const bitDepth = ihdr[8];
  const colourType = ihdr[9];
  const compressionMethod = ihdr[10];
  const filterMethod = ihdr[11];
  const interlaceMethod = ihdr[12];
  if (bitDepth !== BIT_DEPTH) failWith(`the IHDR declares an unsupported bit depth ${bitDepth}`);
  if (colourType !== COLOUR_TYPE_TRUECOLOUR) {
    failWith(`the IHDR declares the unsupported colour type ${colourType}`);
  }
  if (compressionMethod !== COMPRESSION_METHOD_DEFLATE) {
    failWith(`the IHDR declares an unsupported compression method ${compressionMethod}`);
  }
  if (filterMethod !== FILTER_METHOD_ADAPTIVE) {
    failWith(`the IHDR declares an unsupported filter method ${filterMethod}`);
  }
  if (interlaceMethod !== INTERLACE_METHOD_NONE) {
    failWith(`the IHDR declares an unsupported interlace method ${interlaceMethod}`);
  }
  return { width, height };
}

/**
 * Concatenates the IDAT payloads and inflates the compressed raster.
 *
 * @param {Array<{type: string, length: number, body: Buffer}>} chunks Chunk frames.
 * @param {(detail: string) => void} failWith Labelled failure reporter.
 * @returns {Buffer} The decompressed raster bytes.
 */
function inflatePngRaster(chunks, failWith) {
  const idatBodies = chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.body);
  let raster;
  try {
    raster = inflateSync(Buffer.concat(idatBodies));
  } catch (error) {
    failWith(`the IDAT stream does not inflate as a usable zlib payload: ${String(error)}`);
  }
  return /** @type {Buffer} */ (raster);
}
