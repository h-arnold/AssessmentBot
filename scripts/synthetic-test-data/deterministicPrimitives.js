import { Faker, base, en } from '@faker-js/faker';
import { deflateSync } from 'node:zlib';

/**
 * Shared deterministic primitives for synthetic analysis generation.
 *
 * @remarks
 * The generator must never depend on wall-clock time, so every timestamp is
 * derived from this fixed epoch rather than `Date.now()`. Faker instances are
 * seeded explicitly so a profile seed fully identifies the generated corpus.
 */

const SUPPORTED_LOCALES = [en, base];
const MILLISECONDS_PER_MINUTE = 60_000;
const TIMELINE_START_YEAR = 2024;
const TIMELINE_START_DAY = 2;
const TIMELINE_START_HOUR = 9;

/** Fixed, bounded academic timeline start used by every generated timestamp. */
export const TIMELINE_START_MS = Date.UTC(
  TIMELINE_START_YEAR,
  0,
  TIMELINE_START_DAY,
  TIMELINE_START_HOUR,
  0,
  0
);

/**
 * Creates an isolated Faker instance seeded with the given integer.
 *
 * @param {number} seed Deterministic integer seed.
 * @returns {Faker} A seeded Faker instance.
 */
export function createSeededFaker(seed) {
  const faker = new Faker({ locale: SUPPORTED_LOCALES });
  faker.seed(seed);
  return faker;
}

const PNG_SIGNATURE_HEX = '89504e470d0a1a0a';
const PNG_BIT_DEPTH = 8;
const PNG_COLOUR_TYPE_TRUECOLOUR = 2;
const PNG_COMPRESSION_METHOD_DEFLATE = 0;
const PNG_FILTER_METHOD_ADAPTIVE = 0;
const PNG_INTERLACE_METHOD_NONE = 0;
/** Fixed pixel height of every synthetic image; text pixels are laid out horizontally. */
const PNG_IMAGE_HEIGHT = 1;
const PNG_IHDR_PAYLOAD_LENGTH = 13;
const PNG_U32_BYTE_LENGTH = 4;
const PNG_RGB_BYTES_PER_PIXEL = 3;
const PNG_CRC_BYTES = 4;
const PNG_IHDR_GEOMETRY_FLAG_POSITION = 8;

/** CRC-32 local table constants, named so no byte value stays magic. */
const CRC32_TABLE_SIZE = 256;
const CRC_BITS_PER_BYTE = 8;
const CRC32_SHIFT_PER_STEP = 8;
const CRC32_REVERSED_POLYNOMIAL = 0xedb88320;
const CRC32_BYTE_MASK = 0xff;
const CRC32_ALL_BIT_MASK = 0xffffffff;
const PNG_RED_CHANNEL_MASK = 0xff;

/**
 * Builds the byte-wise CRC-32 of a byte sequence.
 *
 * @param {Buffer|Uint8Array} bytes Bytes to checksum.
 * @returns {number} The CRC-32 value.
 */
function crc32(bytes) {
  const crcTable = new Uint32Array(CRC32_TABLE_SIZE);
  for (let byte = 0; byte < CRC32_TABLE_SIZE; byte += 1) {
    let value = byte;
    for (let bit = 0; bit < CRC_BITS_PER_BYTE; bit += 1) {
      value = value & 1 ? CRC32_REVERSED_POLYNOMIAL ^ (value >>> 1) : value >>> 1;
    }
    crcTable.set([value >>> 0], byte);
  }
  let crc = CRC32_ALL_BIT_MASK;
  for (const byte of bytes) {
    const tableIndex = (crc ^ byte) & CRC32_BYTE_MASK;
    crc = (crc >>> CRC32_SHIFT_PER_STEP) ^ Number(crcTable.at(tableIndex));
  }
  return (crc ^ CRC32_ALL_BIT_MASK) >>> 0;
}

/**
 * Assembles one binary PNG chunk.
 *
 * @param {string} type Four-character chunk type.
 * @param {Uint8Array} data Chunk data.
 * @returns {Buffer} Length-prefixed and CRC-checked chunk bytes.
 */
function pngChunk(type, data) {
  const prefix = Buffer.alloc(PNG_U32_BYTE_LENGTH);
  prefix.writeUint32BE(data.length);
  const typedData = Buffer.concat([Buffer.from(type, 'latin1'), Buffer.from(data)]);
  const crc = Buffer.alloc(PNG_CRC_BYTES);
  crc.writeUint32BE(crc32(typedData));
  return Buffer.concat([prefix, typedData, crc]);
}

/**
 * Converts a deterministic text seed into the scanline bytes of a one-row
 * truecolour PNG raster, so the image pixels depend on the text alone.
 *
 * @param {string} text Deterministic text embedded in the image pixels.
 * @returns {Buffer} Raw (filter-prefixed) scanline bytes.
 */
function toPngScanlines(text) {
  const scanline = Buffer.alloc(1 + text.length * PNG_RGB_BYTES_PER_PIXEL);
  for (let column = 0; column < text.length; column += 1) {
    const textByte = /** @type {number} */ (text.codePointAt(column) & PNG_RED_CHANNEL_MASK);
    scanline[1 + column * PNG_RGB_BYTES_PER_PIXEL] = textByte;
  }
  return scanline;
}

/**
 * Converts a deterministic minute offset into an ISO 8601 UTC string.
 *
 * @param {number} minuteOffset Offset in minutes from the fixed timeline start.
 * @returns {string} ISO 8601 UTC timestamp with millisecond precision.
 */
export function isoAt(minuteOffset) {
  return new Date(TIMELINE_START_MS + minuteOffset * MILLISECONDS_PER_MINUTE).toISOString();
}

/**
 * Builds a deterministic, structurally valid PNG as an image data URL.
 *
 * @remarks
 * The bytes are genuine PNG bytes (signature, IHDR, deflated IDAT, IEND) so an
 * image consumer can always decode the artefact body, and the geometry plus
 * pixel values are derived only from the text seed so a fixed seed fully
 * identifies the generated image.
 *
 * @param {string} text Deterministic text embedded in the image pixels.
 * @returns {string} A `data:image/png;base64,` data URL.
 */
export function toImageDataUrl(text) {
  const ihdr = Buffer.alloc(PNG_IHDR_PAYLOAD_LENGTH);
  ihdr.writeUint32BE(text.length, 0);
  ihdr.writeUint32BE(PNG_IMAGE_HEIGHT, PNG_U32_BYTE_LENGTH);
  ihdr.set(
    [
      PNG_BIT_DEPTH,
      PNG_COLOUR_TYPE_TRUECOLOUR,
      PNG_COMPRESSION_METHOD_DEFLATE,
      PNG_FILTER_METHOD_ADAPTIVE,
      PNG_INTERLACE_METHOD_NONE,
    ],
    PNG_IHDR_GEOMETRY_FLAG_POSITION
  );
  const idat = deflateSync(toPngScanlines(text));
  const image = Buffer.concat([
    Buffer.from(PNG_SIGNATURE_HEX, 'hex'),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${image.toString('base64')}`;
}
