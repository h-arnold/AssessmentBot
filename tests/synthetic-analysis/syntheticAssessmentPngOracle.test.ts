import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import {
  buildSyntheticPngDataUrl,
  buildSyntheticPngDataUrlFromIdat,
  assertDecodablePngDataUrl,
} from './syntheticAssessmentImageBodySupport.js';

/**
 * PNG oracle strictness suite: the decoder assertion must inflate the IDAT
 * stream and reconcile the raster with the declared IHDR geometry, so zero-size
 * headers, corrupted compressed payloads with intact CRC checksums, and
 * geometry/raster disagreements are all rejected while the fixed valid builder
 * output keeps decoding.
 */

/**
 * Builds the synthetic IHDR bytes for one image geometry, using the same fixed
 * 8-bit truecolour format as the valid synthetic builder.
 *
 * @param {number} width Image width.
 * @param {number} height Image height.
 * @returns {Buffer} The 13-byte synthetic IHDR body.
 */
function ihdrBytes(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUint32BE(width, 0);
  ihdr.writeUint32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 2; // truecolour (RGB)
  return ihdr;
}

describe('synthetic PNG decoder oracle', () => {
  it.each([
    ['1x1', 1, 1],
    ['2x2', 2, 2],
    ['1-row wide', 6, 1],
    ['tall', 1, 3],
  ])('accepts the valid synthetic builder image %s', (label, width, height) => {
    expect(() =>
      assertDecodablePngDataUrl(buildSyntheticPngDataUrl(width, height), label)
    ).not.toThrow();
  });

  it('rejects a CRC-correct PNG body whose declared width is zero', () => {
    const zeroWidth = buildSyntheticPngDataUrl(0, 1);
    expect(() => assertDecodablePngDataUrl(zeroWidth, 'zero-width PNG')).toThrow(
      /zero-width PNG.*not a decodable PNG.*geometry 0x1/u
    );
  });

  it('rejects a CRC-correct PNG body whose declared height is zero', () => {
    const zeroHeight = buildSyntheticPngDataUrl(1, 0);
    expect(() => assertDecodablePngDataUrl(zeroHeight, 'zero-height PNG')).toThrow(
      /zero-height PNG.*not a decodable PNG.*geometry 1x0/u
    );
  });

  it('rejects a valid-CRC IDAT payload that does not inflate', () => {
    const corrupted = buildSyntheticPngDataUrlFromIdat(
      ihdrBytes(1, 1),
      Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04])
    );
    expect(() => assertDecodablePngDataUrl(corrupted, 'corrupted IDAT PNG')).toThrow(
      /corrupted IDAT PNG.*does not inflate/u
    );
  });

  it('rejects a decodable IDAT whose raster length contradicts the IHDR geometry', () => {
    const shortRaster = buildSyntheticPngDataUrlFromIdat(
      ihdrBytes(2, 1),
      deflateSync(Buffer.from([0, 0, 0]))
    );
    expect(() => assertDecodablePngDataUrl(shortRaster, 'short-raster PNG')).toThrow(
      /short-raster PNG.*raster length 3 does not match the IHDR geometry 2x1/u
    );
  });

  it('rejects an inflated raster carrying an unusable scanline filter byte', () => {
    const badFilter = buildSyntheticPngDataUrlFromIdat(
      ihdrBytes(1, 1),
      deflateSync(Buffer.from([9, 0, 0, 0]))
    );
    expect(() => assertDecodablePngDataUrl(badFilter, 'bad-filter PNG')).toThrow(
      /bad-filter PNG.*scanline 0 carries an unusable filter byte 9/u
    );
  });
});
