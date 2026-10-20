import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const OWNER_PATH = 'src/backend/y_controllers/ABClassController/ABClassMutationOps.js';

describe('ABClass mutation owner GAS evaluation', () => {
  it('loads after validation and before the facade without eager dependency evaluation', () => {
    // Verify the mutation owner is installed by the normal backend bootstrap.
    expect(typeof globalThis.ABClassMutationOps).toBe('function');

    const ownerSource = readFileSync(OWNER_PATH, 'utf8');
    const validationSource = readFileSync(
      'src/backend/y_controllers/ABClassController/ABClassValidation.js',
      'utf8'
    );
    const facadeSource = readFileSync(
      'src/backend/y_controllers/ABClassController/index.js',
      'utf8'
    );
    const context = vm.createContext({
      DbManager: { getInstance: () => ({}) },
      ABClassValidation: class {},
      ABClassPersistence: class {},
      ABClassRoster: class {},
      ABClassAssignmentOps: class {},
      ABClassResponseMapper: class {},
      Validate: { requireParams() {} },
      module: undefined,
    });

    expect(() => vm.runInContext(validationSource, context)).not.toThrow();
    expect(() => vm.runInContext(ownerSource, context)).not.toThrow();
    expect(() => vm.runInContext(facadeSource, context)).not.toThrow();
    expect(() => vm.runInContext('new ABClassController()', context)).not.toThrow();
    expect(vm.runInContext('typeof ABClassMutationOps', context)).toBe('function');
  });

  it('does not use imports, global fallbacks, or a callback to the facade', () => {
    expect(typeof globalThis.ABClassMutationOps).toBe('function');
    const source = readFileSync(OWNER_PATH, 'utf8');

    expect(source).not.toMatch(/^\s*(?:import|export)\s/m);
    expect(source).not.toMatch(/\brequire\s*\(/);
    expect(source).not.toMatch(/globalThis|typeof\s+ABClassController/);
    expect(source).not.toMatch(/this\._controller|this\.controller/);
  });
});
