import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';

const { originalLoader } = vi.hoisted(() => ({ originalLoader: { value: undefined as any } }));

const viewNames = [
  'classPartials',
  'classesById',
  'assignmentsByKey',
  'editableDefinitions',
  'assignmentDefinitionPartials',
] as const;
type ViewName = (typeof viewNames)[number];
type Views = Record<ViewName, any>;

vi.mock('#synthetic-data/loadSyntheticAnalysisProfile.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('#synthetic-data/loadSyntheticAnalysisProfile.js')>();
  originalLoader.value = actual.loadSyntheticAnalysisProfile;
  return { ...actual, loadSyntheticAnalysisProfile: vi.fn(actual.loadSyntheticAnalysisProfile) };
});

import { loadSyntheticAnalysisProfile as loadView } from '#synthetic-data/loadSyntheticAnalysisProfile.js';

function canonicalViews(): Views {
  return Object.fromEntries(viewNames.map((name) => [name, loadView('medium', name)])) as Views;
}

function arrangeCorruption(mutate: (views: Views) => void): { originals: Views; snapshot: Views } {
  const originals = canonicalViews();
  const snapshot = structuredClone(originals);
  const corrupted = structuredClone(originals);
  mutate(corrupted);
  vi.mocked(loadView).mockImplementation((_profile, viewName) => corrupted[viewName as ViewName]);
  return { originals, snapshot };
}

afterEach(() => {
  vi.mocked(loadView).mockImplementation(originalLoader.value);
});

describe('backend model input adapter validation', () => {
  it.each([
    {
      name: 'missing embedded definition key',
      message: /Missing canonical assignment definition key: undefined/u,
      mutate: (views: Views) => {
        delete (Object.values(views.classesById) as any[])[0].assignments[0]
          .assignmentDefinitionKey;
      },
    },
    {
      name: 'unresolved embedded definition key',
      message: /No canonical assignment definition found for "missing-definition"/u,
      mutate: (views: Views) => {
        (Object.values(views.classesById) as any[])[0].assignments[0].assignmentDefinitionKey =
          'missing-definition';
      },
    },
    {
      name: 'definition payload key mismatch',
      message: /Canonical definition key mismatch/u,
      mutate: (views: Views) => {
        const key = Object.keys(views.editableDefinitions)[0];
        views.editableDefinitions[key].definitionKey = 'different-definition';
      },
    },
    {
      name: 'malformed class assignment population',
      message: /Malformed canonical class model input for ".+"/u,
      mutate: (views: Views) => {
        const [classId] = Object.keys(views.classesById);
        views.classesById[classId].assignments = null;
      },
    },
    {
      name: 'standalone assignment without full editable definition',
      message: /has no full canonical definition/u,
      mutate: (views: Views) => {
        const partialOnly = views.assignmentDefinitionPartials.find(
          (definition: any) => !Object.hasOwn(views.editableDefinitions, definition.definitionKey)
        ).definitionKey;
        const assignment = (Object.values(views.assignmentsByKey) as any[])[0];
        expect(assignment).toBeDefined();
        assignment.assignmentDefinition.definitionKey = partialOnly;
      },
    },
    {
      name: 'standalone assignment map-key mismatch',
      message: /Canonical assignment key mismatch for ".+"/u,
      mutate: (views: Views) => {
        const key = Object.keys(views.assignmentsByKey)[0];
        views.assignmentsByKey[key].assignmentId = 'different-assignment';
      },
    },
  ])('fails fast for $name without mutating frozen canonical views', ({ mutate, message }) => {
    const { originals, snapshot } = arrangeCorruption(mutate);
    expect(() => loadBackendModelInputs('medium')).toThrow(message);
    expect(originals).toEqual(snapshot);
    expect(Object.isFrozen(originals.classPartials[0])).toBe(true);
    expect(Object.isFrozen(originals.classesById[Object.keys(originals.classesById)[0]])).toBe(
      true
    );
    expect(
      Object.isFrozen(originals.assignmentsByKey[Object.keys(originals.assignmentsByKey)[0]])
    ).toBe(true);
    expect(
      Object.isFrozen(originals.editableDefinitions[Object.keys(originals.editableDefinitions)[0]])
    ).toBe(true);
    expect(Object.isFrozen(originals.assignmentDefinitionPartials[0])).toBe(true);
  });
});
