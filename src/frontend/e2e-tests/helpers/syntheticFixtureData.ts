import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Directory of the committed canonical synthetic-analysis transport views. */
const SYNTHETIC_DATA_ROOT = path.join(
  import.meta.dirname,
  '../../../../tests/__mocks__/data/synthetic-analysis/'
);

/**
 * Committed fixture manifest. Every `readFileSync` argument is a static
 * expression over this module's directory, as required by
 * `security/detect-non-literal-fs-filename`, and unknown fixtures fail loudly.
 */
const FIXTURE_READERS: Record<string, () => unknown> = {
  'small/assignmentsByKey.json': () =>
    JSON.parse(readFileSync(`${SYNTHETIC_DATA_ROOT}small/assignmentsByKey.json`, 'utf8')),
  'small/classesById.json': () =>
    JSON.parse(readFileSync(`${SYNTHETIC_DATA_ROOT}small/classesById.json`, 'utf8')),
  'small/classPartials.json': () =>
    JSON.parse(readFileSync(`${SYNTHETIC_DATA_ROOT}small/classPartials.json`, 'utf8')),
  'small/assignmentDefinitionPartials.json': () => {
    return JSON.parse(
      readFileSync(`${SYNTHETIC_DATA_ROOT}small/assignmentDefinitionPartials.json`, 'utf8')
    );
  },
  'small/editableDefinitions.json': () =>
    JSON.parse(readFileSync(`${SYNTHETIC_DATA_ROOT}small/editableDefinitions.json`, 'utf8')),
  'medium/assignmentsByKey.json': () =>
    JSON.parse(readFileSync(`${SYNTHETIC_DATA_ROOT}medium/assignmentsByKey.json`, 'utf8')),
  'medium/classesById.json': () =>
    JSON.parse(readFileSync(`${SYNTHETIC_DATA_ROOT}medium/classesById.json`, 'utf8')),
  'medium/classPartials.json': () =>
    JSON.parse(readFileSync(`${SYNTHETIC_DATA_ROOT}medium/classPartials.json`, 'utf8')),
  'medium/assignmentDefinitionPartials.json': () => {
    return JSON.parse(
      readFileSync(`${SYNTHETIC_DATA_ROOT}medium/assignmentDefinitionPartials.json`, 'utf8')
    );
  },
};

/**
 * Reads one committed synthetic-analysis transport view at runtime.
 *
 * Loaded via `fs` rather than a static import: Playwright's loader strips JSON
 * import attributes and hands the module to Node's ESM loader, which rejects
 * bare `.json` imports. `fs` reads work identically in the Playwright and Vitest
 * contexts.
 *
 * @param {'small' | 'medium'} profile - Synthetic data profile directory.
 * @param {string} fileName - Transport view file name.
 * @returns {unknown} Parsed JSON payload.
 */
export function readSyntheticFixture(profile: 'small' | 'medium', fileName: string): unknown {
  const key = `${profile}/${fileName}`;
  const readFixture = FIXTURE_READERS[key];
  if (!readFixture) {
    throw new Error(`Unknown synthetic fixture: ${key}`);
  }
  return readFixture();
}
