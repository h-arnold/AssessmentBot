/**
 * Tests for the selection-cascade reducer (`selectionCascade`).
 *
 * @see docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md §9.22
 *   — cascade rules (a class change atomically clears topic and assignment selections; a topic
 *   change clears assignments whose topic no longer matches; widening the topic set never
 *   restores cleared assignments) and the selection state shape.
 *
 * RED-PHASE: the reducer module is a throwing stub, so every test below fails at
 * runtime for the intended reason (implementation absent).  The assertions pin
 * the exact cascade contract the green-phase implementer must satisfy.
 */

import { describe, expect, it } from 'vitest';
import * as selectionCascadeModule from './selectionCascade';
import type { SelectionCascadeAction, SelectionState } from './selectionCascade';

const selectionCascadeReducer = selectionCascadeModule.selectionCascadeReducer;
const INITIAL_SELECTION_STATE = selectionCascadeModule.INITIAL_SELECTION_STATE;

if (typeof selectionCascadeReducer !== 'function') {
  throw new TypeError(
    'selectionCascade.ts has not been implemented (selectionCascadeReducer export missing)'
  );
}

/**
 * Builds a topic → assignmentId map fixture for cascade validation.
 *
 * @param {ReadonlyArray<readonly [string, string]>} entries - Topic/assignment pairs.
 * @returns {ReadonlyMap<string, string>} The assignment-topic-key map.
 */
function topicMap(entries: ReadonlyArray<readonly [string, string]>): ReadonlyMap<string, string> {
  return new Map(entries);
}

describe('selectionCascadeReducer — class change atomicity', () => {
  it('selecting a class atomically clears topics AND assignments in one state update', () => {
    const start: SelectionState = {
      classId: null,
      topicKeys: ['t1', 't2'],
      assignmentIds: ['a1', 'a2'],
    };

    const next = selectionCascadeReducer(start, { type: 'selectClass', classId: 'c-1' });

    expect(next).toEqual({ classId: 'c-1', topicKeys: [], assignmentIds: [] });
  });

  it('clearing the class (selectClass null) returns the initial no-class state', () => {
    const start: SelectionState = {
      classId: 'c-1',
      topicKeys: ['t1'],
      assignmentIds: ['a1'],
    };

    const next = selectionCascadeReducer(start, { type: 'selectClass', classId: null });

    expect(next).toEqual(INITIAL_SELECTION_STATE);
  });

  it('re-dispatching an identical selectClass action leaves state equal (idempotent)', () => {
    const start: SelectionState = {
      classId: 'c-1',
      topicKeys: ['t1'],
      assignmentIds: ['a1'],
    };

    const once = selectionCascadeReducer(start, { type: 'selectClass', classId: 'c-1' });
    const twice = selectionCascadeReducer(once, { type: 'selectClass', classId: 'c-1' });

    expect(twice).toEqual(once);
  });
});

describe('selectionCascadeReducer — topic narrowing / widening', () => {
  it('narrowing topics clears assignment selections no longer valid under the active topic set', () => {
    const start: SelectionState = {
      classId: 'c-1',
      topicKeys: [],
      assignmentIds: ['a1', 'a2'],
    };

    const next = selectionCascadeReducer(start, {
      type: 'changeTopics',
      topicKeys: ['t1'],
      assignmentTopicKeys: topicMap([
        ['a1', 't1'],
        ['a2', 't2'],
      ]),
    });

    expect(next.topicKeys).toEqual(['t1']);
    expect(next.assignmentIds).toEqual(['a1']);
  });

  it('zero topics selected = no constraint (all assignments remain valid)', () => {
    const start: SelectionState = {
      classId: 'c-1',
      topicKeys: ['t1'],
      assignmentIds: ['a1'],
    };

    const next = selectionCascadeReducer(start, {
      type: 'changeTopics',
      topicKeys: [],
      assignmentTopicKeys: topicMap([['a1', 't1']]),
    });

    expect(next.topicKeys).toEqual([]);
    expect(next.assignmentIds).toEqual(['a1']);
  });

  it('widening topics restores NOTHING (previously cleared assignments stay cleared)', () => {
    let state: SelectionState = {
      classId: 'c-1',
      topicKeys: [],
      assignmentIds: ['a1', 'a2'],
    };

    // Narrow to t1 → a2 (topic t2) is cleared.
    state = selectionCascadeReducer(state, {
      type: 'changeTopics',
      topicKeys: ['t1'],
      assignmentTopicKeys: topicMap([
        ['a1', 't1'],
        ['a2', 't2'],
      ]),
    });
    expect(state.assignmentIds).toEqual(['a1']);

    // Widen back to t1 + t2 → a2 must NOT reappear.
    state = selectionCascadeReducer(state, {
      type: 'changeTopics',
      topicKeys: ['t1', 't2'],
      assignmentTopicKeys: topicMap([
        ['a1', 't1'],
        ['a2', 't2'],
      ]),
    });
    expect(state.assignmentIds).toEqual(['a1']);
  });

  it('re-dispatching an identical changeTopics action leaves state equal (idempotent)', () => {
    const start: SelectionState = {
      classId: 'c-1',
      topicKeys: [],
      assignmentIds: ['a1', 'a2'],
    };
    const action: SelectionCascadeAction = {
      type: 'changeTopics',
      topicKeys: ['t1'],
      assignmentTopicKeys: topicMap([
        ['a1', 't1'],
        ['a2', 't2'],
      ]),
    };

    const once = selectionCascadeReducer(start, action);
    const twice = selectionCascadeReducer(once, action);

    expect(twice).toEqual(once);
  });
});

describe('selectionCascadeReducer — assignment selection', () => {
  it('changeAssignments sets the assignment selection directly without altering class or topics', () => {
    const start: SelectionState = {
      classId: 'c-1',
      topicKeys: ['t1'],
      assignmentIds: [],
    };

    const next = selectionCascadeReducer(start, {
      type: 'changeAssignments',
      assignmentIds: ['a1', 'a2'],
    });

    expect(next).toEqual({
      classId: 'c-1',
      topicKeys: ['t1'],
      assignmentIds: ['a1', 'a2'],
    });
  });

  it('re-dispatching an identical changeAssignments action leaves state equal (idempotent)', () => {
    const start: SelectionState = {
      classId: 'c-1',
      topicKeys: ['t1'],
      assignmentIds: ['a1'],
    };
    const action: SelectionCascadeAction = {
      type: 'changeAssignments',
      assignmentIds: ['a1'],
    };

    const once = selectionCascadeReducer(start, action);
    const twice = selectionCascadeReducer(once, action);

    expect(twice).toEqual(once);
  });
});
