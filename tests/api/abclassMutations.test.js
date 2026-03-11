import { describe, expect, it } from 'vitest';

describe('Api/abclassMutations exports', () => {
  it('exports upsertABClass, updateABClass, and deleteABClass in Node test runtime', () => {
    const abclassMutationsModule = require('../../src/backend/z_Api/abclassMutations.js');

    expect(abclassMutationsModule).toEqual(
      expect.objectContaining({
        upsertABClass: expect.any(Function),
        updateABClass: expect.any(Function),
        deleteABClass: expect.any(Function),
      })
    );
  });

  it.each([['upsertABClass'], ['updateABClass'], ['deleteABClass']])(
    'throws a not-implemented error when %s is called directly in Node test runtime',
    (methodName) => {
      const abclassMutationsModule = require('../../src/backend/z_Api/abclassMutations.js');

      expect(() => abclassMutationsModule[methodName]({})).toThrowError(/not implemented/i);
    }
  );
});
