import { describe, expect, it } from 'vitest';

import {
  artefactsOfTask,
  expectUsableArtefactBody,
  requireDefined,
} from './syntheticAssessmentContractSupport.js';
import {
  CONTENT_RULE,
  expectRule,
  HASH_RULE,
  IMAGE_RULE,
  SPREADSHEET_RULE,
} from './syntheticAssessmentValidationRules.js';
import {
  USABLE_IMAGE_DATA_URL,
  USABLE_SPREADSHEET_GRID,
} from './syntheticAssessmentSourceMatrices.js';

/**
 * Shared-requirement source matrix: the required reference/template artefacts
 * embedded in a completed full assignment.
 *
 * @remarks
 * This is the completed-assignment boundary, not the independent definition
 * store: the definition store may legitimately keep a pending IMAGE artefact
 * before a run, but a completed full assignment's required shared inputs must
 * carry usable, non-null content and a string hash in their raw shapes. Rows
 * mutate exactly one artefact of one role; each rejection names the owned rule
 * plus the mutated task/role path. Blank non-null bodies are scoped per role:
 * the canonical contract preserves valid blank TEXT/array templates, so a
 * blank body rejects only on the reference requirement while a blank template
 * with a string hash is accepted. The body constants and the artefact walker
 * are reused from the submission source matrix and contract support so the
 * two matrices describe the same raw representations.
 */

/** @typedef {import('./syntheticAssessmentValidationOwners.js').DefinitionTaskTarget} DefinitionTaskTarget */

const ROLES = ['reference', 'template'];

/** @typedef {{taskId: string, task: Record<string, unknown>, subject: {validate: () => void}}} BoundaryTarget */

/**
 * Narrow the required artefact of one role on a completed definition task.
 *
 * @param {DefinitionTaskTarget} target Completed definition task target.
 * @param {string} role Artefact role to select.
 * @returns {Record<string, unknown>} The role artefact record.
 */
function artefactOfRole(target, role) {
  const match = artefactsOfTask(target.task).find((artefact) => artefact.role === role);
  return requireDefined(match, `${role} artefact of task ${target.taskId}`);
}

/**
 * Resolves a fresh completed definition task target for one owning subject.
 *
 * @param {{validate: () => void, definitionTask: () => DefinitionTaskTarget}} subject Validating owner.
 * @returns {BoundaryTarget} Subject plus its resolved task.
 */
function targetOf(subject) {
  const task = subject.definitionTask();
  return { taskId: task.taskId, task: requireDefined(task.task, 'definition task'), subject };
}

/**
 * Reshapes one artefact into a completed IMAGE artefact with the given body.
 *
 * @param {Record<string, unknown>} artefact Artefact record to reshape.
 * @param {string|null} content IMAGE body to store; null means pending state.
 */
function applyImageBody(artefact, content) {
  artefact.type = 'IMAGE';
  artefact.content = content;
  artefact.contentHash = content === null ? null : 'hash-completed-image-body';
}

/**
 * Reshapes one artefact into a completed SPREADSHEET artefact.
 *
 * @param {Record<string, unknown>} artefact Artefact record to reshape.
 * @param {unknown} content Raw body to store.
 */
function applySpreadsheetBody(artefact, content) {
  artefact.type = 'SPREADSHEET';
  artefact.content = structuredClone(content);
  artefact.contentHash = 'hash-completed-spreadsheet-body';
}

/**
 * Shared rejection rows for unusable artefact content/hash; each mutation
 * receives the role under test so both artefact roles carry real proof.
 * Blank non-null bodies are NOT shared here: the canonical contract preserves
 * valid blank TEXT/array templates, and the reference-only blank requirement
 * is asserted separately in its own role-scoped rows.
 *
 * @type {ReadonlyArray<[string, (artefact: Record<string, unknown>) => void, string]>}
 */
const SHARED_REJECTION_ROWS = [
  [
    'null artefact content',
    (artefact) => {
      artefact.content = null;
    },
    CONTENT_RULE,
  ],
  [
    'a missing artefact content key',
    (artefact) => {
      delete artefact.content;
    },
    CONTENT_RULE,
  ],
  [
    'a null artefact contentHash',
    (artefact) => {
      artefact.contentHash = null;
    },
    HASH_RULE,
  ],
  [
    'a missing artefact contentHash key',
    (artefact) => {
      delete artefact.contentHash;
    },
    HASH_RULE,
  ],
];

/**
 * Runs the completed-assignment reference/template source matrix for one
 * owning validator.
 *
 * @param {{
 *   describe: string,
 *   subject: () => import('./syntheticAssessmentValidationOwners.js').ValidatorOwner,
 * }} config Suite configuration.
 */
export function runDefinitionSourceMatrix(config) {
  describe(config.describe, () => {
    it('accepts the canonical baseline with usable required artefacts in their raw shapes', () => {
      const subject = config.subject();
      const target = targetOf(subject);
      for (const role of ROLES) {
        const artefact = artefactOfRole(target, role);
        expect(artefact.type).toBe('TEXT');
        expectUsableArtefactBody(artefact, `${role} artefact of ${target.taskId}`);
      }
      expect(subject.validate).not.toThrow();
    });

    it.each(ROLES)('accepts a usable completed %s IMAGE artefact', (role) => {
      const subject = config.subject();
      const target = targetOf(subject);
      applyImageBody(artefactOfRole(target, role), USABLE_IMAGE_DATA_URL);
      const artefact = artefactOfRole(target, role);
      expect(artefact.content).toMatch(/^data:image\//u);
      expect(artefact.contentHash).not.toBeNull();
      expect(subject.validate).not.toThrow();
    });

    it.each(ROLES)('accepts a usable completed %s SPREADSHEET artefact in its raw grid', (role) => {
      const subject = config.subject();
      const target = targetOf(subject);
      applySpreadsheetBody(artefactOfRole(target, role), USABLE_SPREADSHEET_GRID);
      expect(artefactOfRole(target, role).content).toStrictEqual(
        structuredClone(USABLE_SPREADSHEET_GRID)
      );
      expect(subject.validate).not.toThrow();
    });

    describe.each(ROLES)('unusable %s artefact rejections', (role) => {
      it.each(SHARED_REJECTION_ROWS)('rejects %s', (_label, mutate, rule) => {
        const subject = config.subject();
        const target = targetOf(subject);
        mutate(artefactOfRole(target, role));
        expectRule(subject.validate, rule, [target.taskId, role]);
      });

      it('rejects a pending IMAGE body beside completed results', () => {
        const subject = config.subject();
        const target = targetOf(subject);
        applyImageBody(artefactOfRole(target, role), null);
        expectRule(subject.validate, CONTENT_RULE, [target.taskId, role]);
      });

      it('rejects an IMAGE body that is not a usable data URL', () => {
        const subject = config.subject();
        const target = targetOf(subject);
        applyImageBody(artefactOfRole(target, role), 'not-an-image-body');
        expectRule(subject.validate, IMAGE_RULE, [target.taskId, role]);
      });

      it('rejects a SPREADSHEET body encoded as a JSON string', () => {
        const subject = config.subject();
        const target = targetOf(subject);
        applySpreadsheetBody(artefactOfRole(target, role), JSON.stringify(USABLE_SPREADSHEET_GRID));
        expectRule(subject.validate, SPREADSHEET_RULE, [target.taskId, role]);
      });
    });

    describe('blank-body role scoping', () => {
      it('rejects a blank TEXT reference body beside completed results', () => {
        const subject = config.subject();
        const target = targetOf(subject);
        const artefact = artefactOfRole(target, 'reference');
        artefact.content = '';
        expectRule(subject.validate, CONTENT_RULE, [target.taskId, 'reference']);
      });

      it('accepts a blank TEXT template body retaining its string hash', () => {
        const subject = config.subject();
        const target = targetOf(subject);
        artefactOfRole(target, 'template').content = '';
        expect(subject.validate).not.toThrow();
      });

      it('accepts a blank SPREADSHEET template body retaining its string hash', () => {
        const subject = config.subject();
        const target = targetOf(subject);
        applySpreadsheetBody(artefactOfRole(target, 'template'), []);
        expect(artefactOfRole(target, 'template').content).toStrictEqual([]);
        expect(subject.validate).not.toThrow();
      });
    });
  });
}
