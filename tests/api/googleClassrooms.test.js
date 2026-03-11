import { describe, expect, it } from 'vitest';

describe('Api/googleClassrooms exports', () => {
  it('exports getGoogleClassrooms in Node test runtime', () => {
    const googleClassroomsModule = require('../../src/backend/z_Api/googleClassrooms.js');

    expect(googleClassroomsModule).toEqual(
      expect.objectContaining({
        getGoogleClassrooms: expect.any(Function),
      })
    );
  });

  it('throws a not-implemented error when called directly in Node test runtime', () => {
    const { getGoogleClassrooms } = require('../../src/backend/z_Api/googleClassrooms.js');

    expect(() => getGoogleClassrooms({})).toThrowError(/not implemented/i);
  });
});
