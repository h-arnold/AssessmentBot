import { expect } from 'vitest';

import { loadSyntheticAnalysisProfile } from '#synthetic-data/loadSyntheticAnalysisProfile.js';

/**
 * Canonical profile payloads and the lookups shared by the backend model input
 * suites.
 *
 * @remarks
 * The canonical payloads are loaded once per profile and the derived maps are
 * built from them, so each assertion helper receives one context rather than
 * re-deriving the same lookups.
 */

/** A raw JSON record from the generated corpus. */
export type JsonRecord = Record<string, any>;

/** The three adapter outputs under test. */
export type Inputs = {
  classPartials: JsonRecord[];
  classesById: Record<string, JsonRecord>;
  assignmentsByKey: Record<string, JsonRecord>;
};

/** Canonical profile payloads loaded before the adapter runs. */
export type CanonicalSources = {
  partials: JsonRecord[];
  classes: Record<string, JsonRecord>;
  assignments: Record<string, JsonRecord>;
  definitions: Record<string, JsonRecord>;
  definitionPartials: JsonRecord[];
  editableDefinitions?: Record<string, JsonRecord>;
};

/** Lookups and flags shared across the adapter assertions. */
export type AdapterContext = {
  definitions: Record<string, JsonRecord>;
  partialByClassId: Map<string, JsonRecord>;
  assignmentsByClassId: Map<string, JsonRecord[]>;
  partialAssignmentsById: Map<string, JsonRecord>;
  fullAssignmentsById: Map<string, JsonRecord>;
  found: { populatedFullSubmission: boolean; restoredClassOwner: boolean };
};

/** The canonical payloads plus the derived lookups. */
export type AdapterSources = CanonicalSources & AdapterContext;

/**
 * Returns the sorted keys of a record.
 *
 * @param value The record to inspect.
 * @returns The sorted key list.
 */
export function keySet(value: Record<string, unknown>): string[] {
  return Object.keys(value).sort();
}

/**
 * Resolves a definition by key, asserting the key is known.
 *
 * @param definitionKey The definition key to resolve.
 * @param definitions The definitions keyed by definition key.
 * @returns The resolved definition.
 */
export function definitionFor(
  definitionKey: string,
  definitions: Record<string, JsonRecord>
): JsonRecord {
  expect(typeof definitionKey).toBe('string');
  expect(definitions[definitionKey]).toBeDefined();
  return definitions[definitionKey];
}

/**
 * Loads the canonical payloads and builds the lookups the assertions share.
 *
 * @param profile The supported profile name.
 * @returns The canonical payloads and derived lookups.
 */
export function loadAdapterContext(profile: string): AdapterSources {
  const load = (key: string) => loadSyntheticAnalysisProfile(profile, key) as JsonRecord;
  const partials = load('classPartials') as JsonRecord[];
  const classes = load('classesById');
  const assignments = load('assignmentsByKey');
  const definitionPartials = load('assignmentDefinitionPartials') as JsonRecord[];
  const definitions = Object.fromEntries([
    ...Object.entries(load('editableDefinitions')),
    ...definitionPartials.map((definition) => [definition.definitionKey, definition]),
  ]);
  const partialAssignmentsById = new Map<string, JsonRecord>();
  for (const classView of Object.values(classes)) {
    for (const assignment of classView.assignments) {
      partialAssignmentsById.set(assignment.assignmentId, assignment);
    }
  }
  return {
    partials,
    classes,
    assignments,
    definitions,
    definitionPartials,
    partialByClassId: new Map(partials.map((row) => [row.classId, row])),
    assignmentsByClassId: new Map(
      Object.entries(classes).map(([classId, classView]) => [classId, classView.assignments])
    ),
    partialAssignmentsById,
    fullAssignmentsById: new Map(
      Object.values(assignments).map((assignment) => [assignment.assignmentId, assignment])
    ),
    found: { populatedFullSubmission: false, restoredClassOwner: false },
  };
}
