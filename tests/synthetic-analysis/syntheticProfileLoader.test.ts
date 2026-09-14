import { describe, expect, it } from 'vitest';

import { loadSyntheticAnalysisProfile } from '../../scripts/synthetic-test-data/loadSyntheticAnalysisProfile.js';

const SMALL_PROFILE_NAME = 'small';
const MEDIUM_PROFILE_NAME = 'medium';
const REPRESENTATIVE_PROFILE_NAME = 'large-representative';
const FULL_LARGE_PROFILE_NAME = 'large-full';
const UNSUPPORTED_PROFILE_NAME = 'not-a-profile';
const UNSUPPORTED_VIEW_NAME = 'not-a-view';
const COMMITTED_PROFILE_NAMES = [
  SMALL_PROFILE_NAME,
  MEDIUM_PROFILE_NAME,
  REPRESENTATIVE_PROFILE_NAME,
] as const;
const SUPPORTED_VIEW_NAMES = [
  'manifest',
  'classPartials',
  'assignmentDefinitionPartials',
  'classesById',
  'assignmentsByKey',
] as const;

/**
 * Loader observation of the committed manifest view.
 */
type LoadedManifest = {
  schemaVersion: number;
  profile: string;
  seed: number;
  generatedEntityCounts: Record<string, number>;
};

/**
 * Recursively asserts that every object and array reachable from a loaded view
 * is frozen, so no test can mutate a shared committed fixture.
 *
 * @param value The value to inspect.
 * @param path The dotted path used to make a failure actionable.
 * @returns The number of object or array nodes inspected, including the root.
 */
function expectDeeplyFrozen(value: unknown, path: string): number {
  if (value === null || typeof value !== 'object') {
    return 0;
  }

  expect(Object.isFrozen(value), `${path} must be frozen`).toBe(true);

  if (Array.isArray(value)) {
    let inspected = 1;
    value.forEach((entry, index) => {
      inspected += expectDeeplyFrozen(entry, `${path}[${index}]`);
    });
    return inspected;
  }

  let inspected = 1;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    inspected += expectDeeplyFrozen(entry, `${path}.${key}`);
  }
  return inspected;
}

describe('synchronous immutable committed profile loading', () => {
  it('loads a named manifest view synchronously', () => {
    const manifest = loadSyntheticAnalysisProfile(SMALL_PROFILE_NAME, 'manifest') as LoadedManifest;

    expect(manifest.profile).toBe(SMALL_PROFILE_NAME);
    expect(manifest.schemaVersion).toBe(1);
    expect(Object.keys(manifest.generatedEntityCounts).length).toBeGreaterThan(0);
  });

  it('returns a recursively deep-frozen tree for every supported committed view', () => {
    for (const profileName of COMMITTED_PROFILE_NAMES) {
      for (const viewName of SUPPORTED_VIEW_NAMES) {
        const view = loadSyntheticAnalysisProfile(profileName, viewName);
        const inspectedNodes = expectDeeplyFrozen(view, `${profileName}.${viewName}`);

        expect(
          inspectedNodes,
          `${profileName}.${viewName} must expose nested objects to freeze`
        ).toBeGreaterThan(1);
      }
    }
  });

  it('prevents local mutation of a frozen view', () => {
    const manifest = loadSyntheticAnalysisProfile(SMALL_PROFILE_NAME, 'manifest') as LoadedManifest;

    expect(() => {
      manifest.generatedEntityCounts.classes = 0;
    }).toThrow(TypeError);
  });

  it('rejects an unsupported profile name', () => {
    expect(() => loadSyntheticAnalysisProfile(UNSUPPORTED_PROFILE_NAME, 'manifest')).toThrow(
      /not-a-profile/u
    );
  });

  it('rejects an unsupported view name', () => {
    expect(() => loadSyntheticAnalysisProfile(SMALL_PROFILE_NAME, UNSUPPORTED_VIEW_NAME)).toThrow(
      /not-a-view/u
    );
  });

  it('rejects the on-demand full-large profile because it is not a committed compact fixture', () => {
    expect(() => loadSyntheticAnalysisProfile(FULL_LARGE_PROFILE_NAME, 'manifest')).toThrow(
      /large-full/u
    );
  });
});
