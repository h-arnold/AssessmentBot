import { describe, expect, it, vi } from 'vitest';

const ApiValidationError = require('#backend/Utils/ErrorTypes/ApiValidationError.js');

function loadMutations() {
  delete require.cache[require.resolve('#backend/z_Api/abclass/abclassMutations.js')];
  return require('#backend/z_Api/abclass/abclassMutations.js');
}

describe('ABClass mutation classId validation', () => {
  it.each([' class-001', 'class-001 ', 'class\x00id', 'class\x1Fid', 'class\x7Fid'])(
    'rejects unsafe identifier %j before controller delegation',
    (classId) => {
      globalThis.ABClassController = vi.fn(function Controller() {
        this.updateABClass = vi.fn();
      });
      const { updateABClass_ } = loadMutations();
      expect(() => updateABClass_({ classId })).toThrow(ApiValidationError);
      expect(globalThis.ABClassController).not.toHaveBeenCalled();
    }
  );

  it('delegates a valid trimmed identifier unchanged', () => {
    const updateABClass = vi.fn(() => ({ classId: 'class-001' }));
    globalThis.ABClassController = vi.fn(function Controller() {
      this.updateABClass = updateABClass;
    });
    const { updateABClass_ } = loadMutations();
    const params = { classId: 'class-001' };
    expect(updateABClass_(params)).toEqual({ classId: 'class-001' });
    expect(updateABClass).toHaveBeenCalledWith(params);
  });
});
