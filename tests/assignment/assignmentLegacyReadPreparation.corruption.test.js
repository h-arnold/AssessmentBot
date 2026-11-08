/**
 * Legacy read preparation: per-task corruption isolation and malformed item maps.
 *
 * One invalid assessment map, missing criterion, invalid score, invalid artefact
 * or contradictory source on an item yields exactly one all-criteria
 * validation/CORRUPT_RECORD E for that task, while healthy sibling items and
 * neighbouring submissions stay unchanged.
 */
const AssignmentLegacyRead = require('#backend/AssignmentProcessor/Assignment/02_AssignmentLegacyRead.js');

import { describe, expect, it } from 'vitest';
import {
  corruptRecordAssessments,
  embeddedTaskIds,
  healthyFullRecord,
  prepare,
  restoreLegacy,
} from './assignmentLegacyReadPreparationSupport.js';

const HEAD_TASK_ID = 'task-1-0';
const SIBLING_TASK_ID = 'task-1-1';

/** Indices in the canonical `small` record: document-bearing and null-parent. */
const DOCUMENT_SUBMISSION_INDEX = 3;
const NULL_PARENT_SUBMISSION_INDEX = 2;

/** Restores a full record carrying exactly the selected document submission. */
function singleDocumentSubmissionRecord() {
  const record = healthyFullRecord();
  record.submissions = [record.submissions[DOCUMENT_SUBMISSION_INDEX]];
  return record;
}

/** Asserts the prepared item is the all-criteria CORRUPT_RECORD placeholder. */
function expectCorruptPlaceholder(item) {
  expect(item).toBeDefined();
  expect(item.assessments).toEqual(corruptRecordAssessments());
  expect(item.feedback).toEqual({});
}

describe('legacy read preparation per-task corruption isolation', () => {
  it.each([
    [
      'a null assessment map',
      (item) => {
        item.assessments = null;
      },
    ],
    [
      'a malformed assessment map',
      (item) => {
        item.assessments = { ancientRubric: { verdict: [null, 9] } };
      },
    ],
    [
      'a missing criterion',
      (item) => {
        delete item.assessments.spag;
      },
    ],
    [
      'an invalid score',
      (item) => {
        item.assessments.accuracy.score = 12;
      },
    ],
    [
      'an invalid artefact body',
      (item) => {
        item.artifact = { ...item.artifact, content: 42 };
      },
    ],
  ])('turns %s into one all-criteria E for that task only', (_label, mutate) => {
    const record = singleDocumentSubmissionRecord();
    const sibling = structuredClone(record.submissions[0].items[SIBLING_TASK_ID]);
    mutate(record.submissions[0].items[HEAD_TASK_ID]);
    // Snapshot after the local corruption probe so the final assertion isolates
    // any mutation performed by preparation itself.
    const before = structuredClone(record);
    // The mutation only touched the head item; the sibling stays byte-identical.
    expect(record.submissions[0].items[SIBLING_TASK_ID]).toEqual(sibling);

    const prepared = prepare(restoreLegacy(record), 'full');
    const submission = prepared[0];
    expectCorruptPlaceholder(submission.items[HEAD_TASK_ID]);
    expect(submission.items[SIBLING_TASK_ID].assessments).toEqual(sibling.assessments);
    expect(submission.items[SIBLING_TASK_ID].artifact.content).toBe(sibling.artifact.content);
    expect(Object.keys(submission.items).sort()).toEqual([HEAD_TASK_ID, SIBLING_TASK_ID]);
    // The stored record is never rewritten by preparation.
    expect(record).toEqual(before);
  });

  it('isolates a corrupt item without disturbing healthy sibling submissions', () => {
    const record = healthyFullRecord();
    const healthyIds = record.submissions.map((submission) => submission.studentId);
    const corruptId = record.submissions[0].studentId;
    record.submissions[0].items[HEAD_TASK_ID].assessments = { broken: true };
    const before = structuredClone(record);

    const prepared = prepare(restoreLegacy(record), 'full');
    expect(prepared.map((submission) => submission.studentId).sort()).toEqual(
      [...healthyIds].sort()
    );
    const corrupt = prepared.find((submission) => submission.studentId === corruptId);
    expectCorruptPlaceholder(corrupt.items[HEAD_TASK_ID]);
    for (const other of prepared.filter((submission) => submission.studentId !== corruptId)) {
      const stored = record.submissions.find((entry) => entry.studentId === other.studentId);
      for (const [taskId, storedItem] of Object.entries(stored.items)) {
        expect(other.items[taskId].assessments).toEqual(storedItem.assessments);
      }
    }
    expect(record).toEqual(before);
  });

  it('treats a numeric result beside a null body on a document submission as contradictory', () => {
    const record = singleDocumentSubmissionRecord();
    const item = record.submissions[0].items[HEAD_TASK_ID];
    item.artifact.content = null;
    item.artifact.contentHash = null;
    expect(item.assessments.completeness.score).toBe(3);

    const prepared = prepare(restoreLegacy(record), 'full');
    expectCorruptPlaceholder(prepared[0].items[HEAD_TASK_ID]);
    expect(prepared[0].items[SIBLING_TASK_ID].assessments).toEqual(
      record.submissions[0].items[SIBLING_TASK_ID].assessments
    );
  });
});

describe('legacy read preparation malformed item maps and missing tasks', () => {
  const malformedRow = [
    ['null', () => null],
    ['missing', null],
    ['an array', () => []],
    ['a string', () => 'not-an-item-map'],
  ];

  it.each(malformedRow)(
    'yields one E per embedded task when items is %s, on both output forms',
    (_label, buildItems) => {
      const record = healthyFullRecord();
      record.submissions = [record.submissions[DOCUMENT_SUBMISSION_INDEX]];
      if (buildItems === null) {
        Reflect.deleteProperty(record.submissions[0], 'items');
      } else {
        record.submissions[0].items = buildItems();
      }

      const taskIds = [...embeddedTaskIds(restoreLegacy(healthyFullRecord()))].sort();
      expect(taskIds.length).toBeGreaterThan(0);
      for (const form of ['full', 'partial']) {
        const prepared = prepare(restoreLegacy(record), form);
        expect(prepared).toHaveLength(1);
        expect(Object.keys(prepared[0].items).sort()).toEqual(taskIds);
        for (const taskId of taskIds) expectCorruptPlaceholder(prepared[0].items[taskId]);
      }
    }
  );

  it('materialises the existing missing-task E for a known task with no stored item', () => {
    const record = singleDocumentSubmissionRecord();
    Reflect.deleteProperty(record.submissions[0].items, SIBLING_TASK_ID);
    const prepared = prepare(restoreLegacy(record), 'full');
    expectCorruptPlaceholder(prepared[0].items[SIBLING_TASK_ID]);
    expect(prepared[0].items[HEAD_TASK_ID].assessments).toEqual(
      record.submissions[0].items[HEAD_TASK_ID].assessments
    );
    expect(Object.keys(prepared[0].items).sort()).toEqual([HEAD_TASK_ID, SIBLING_TASK_ID]);
  });

  it('covers a non-empty null-parent submission that is missing stored items', () => {
    const record = healthyFullRecord();
    const nullParent = structuredClone(record.submissions[NULL_PARENT_SUBMISSION_INDEX]);
    expect(nullParent.documentId).toBeNull();
    // Keep only one stored item so the other known task is a missing-item case.
    const storedTaskIds = Object.keys(nullParent.items);
    expect(storedTaskIds.length).toBeGreaterThan(1);
    for (const taskId of storedTaskIds.slice(1)) Reflect.deleteProperty(nullParent.items, taskId);
    record.submissions = [nullParent];

    const taskIds = [...embeddedTaskIds(restoreLegacy(healthyFullRecord()))].sort();
    const prepared = prepare(restoreLegacy(record), 'full');
    expect(Object.keys(prepared[0].items).sort()).toEqual(taskIds);
    expectCorruptPlaceholder(prepared[0].items[storedTaskIds[1]]);
  });

  it('keeps a genuinely empty null-parent submission as the no-submission representation', () => {
    const record = healthyFullRecord();
    const nullParent = structuredClone(record.submissions[NULL_PARENT_SUBMISSION_INDEX]);
    nullParent.items = {};
    record.submissions = [nullParent];

    const prepared = prepare(restoreLegacy(record), 'full');
    expect(prepared).toHaveLength(1);
    expect(prepared[0].items).toEqual({});
    expect(prepared[0].documentId).toBeNull();
  });
});

describe('legacy read preparation untrustworthy submission elements', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('rejects a %s submissions element with the contextual identity error', (_label, element) => {
    const record = healthyFullRecord();
    record.submissions = [element];

    let thrown;
    try {
      prepare(restoreLegacy(record), 'full');
    } catch (error) {
      thrown = error;
    }

    // The contextual rejection replaces the raw `TypeError` a bare `stored.items`
    // dereference produced for the same shape.
    expect(thrown).toBeDefined();
    expect(thrown).not.toBeInstanceOf(TypeError);
    expect(thrown.name).toBe('Error');
    expect(thrown.message).toBe('Current submission identity is untrustworthy');
  });
});

describe('legacy read preparation materialised own __proto__ item keys', () => {
  /**
   * Builds a stored item map whose `__proto__` key is genuinely own-and-materialised,
   * exactly as the vendored JsonDbApp's `JSON.parse` revival produces; an object
   * literal `__proto__:` would set the prototype instead.
   *
   * @param {object} siblingItem Stored item for the sibling task.
   * @returns {object} Stored item map with the injected key.
   */
  function storedItemsWithProtoKey(siblingItem) {
    const storedItems = JSON.parse(
      `{"__proto__": {"taskId": "${HEAD_TASK_ID}", "artifact": {"broken": true}}}`
    );
    storedItems[SIBLING_TASK_ID] = siblingItem;
    return storedItems;
  }

  it('keeps a materialised own __proto__ item key as an own property on the isolated map', () => {
    const record = singleDocumentSubmissionRecord();
    const stored = record.submissions[0];
    const storedItems = storedItemsWithProtoKey(structuredClone(stored.items[SIBLING_TASK_ID]));
    stored.items = storedItems;
    expect(Object.getOwnPropertyDescriptor(storedItems, '__proto__')).toBeDefined();

    const isolated = new AssignmentLegacyRead()._selectStoredItems(stored);

    const descriptor = Object.getOwnPropertyDescriptor(isolated.items, '__proto__');
    expect(descriptor).toBeDefined();
    expect(descriptor.enumerable).toBe(true);
    expect(descriptor.writable).toBe(true);
    expect(descriptor.configurable).toBe(true);
    expect(descriptor.value).toEqual({ taskId: HEAD_TASK_ID, artifact: { broken: true } });
    // The isolated map keeps the null prototype, so the stored key can never
    // silently become a prototype mutation.
    expect(Object.getPrototypeOf(isolated.items)).toBeNull();
    // The stored map's own key survives isolation untouched.
    expect(Object.getOwnPropertyDescriptor(storedItems, '__proto__').value).toEqual({
      taskId: HEAD_TASK_ID,
      artifact: { broken: true },
    });
  });

  it('rejects the materialised __proto__ item key loudly instead of silently dropping it', () => {
    const record = singleDocumentSubmissionRecord();
    const stored = record.submissions[0];
    stored.items = storedItemsWithProtoKey(structuredClone(stored.items[SIBLING_TASK_ID]));
    const before = structuredClone(record);

    // A dropped entry would let preparation succeed with the key gone; the kept
    // key reaches the current-format owner, which rejects it by name.
    expect(() => prepare(restoreLegacy(record), 'full')).toThrowError(
      'Unknown task key: __proto__'
    );
    expect(record).toEqual(before);
  });
});
