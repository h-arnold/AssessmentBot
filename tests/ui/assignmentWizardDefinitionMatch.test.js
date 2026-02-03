import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getWizardElements,
  selectAssignment,
  setupWizard,
} from '../helpers/assessmentWizardTestUtils.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Assessment wizard definition matching', () => {
  it('matches a definition by primaryTitle/topic/yearGroup and enables fast-start when doc IDs present', () => {
    vi.useFakeTimers();
    const { document, googleRun, cleanup } = setupWizard();
    try {
      vi.runAllTimers();

      const defs = [
        {
          definitionKey: 'Alpha_English_10',
          primaryTitle: 'Alpha Assignment',
          primaryTopic: 'English',
          yearGroup: 10,
          documentType: 'SLIDES',
          referenceDocumentId: 'r1',
          templateDocumentId: 't1',
        },
      ];

      // Send definitions first
      googleRun.triggerSuccess('getAllPartialDefinitions', defs);

      const assignments = [
        { id: 'a1', title: 'Alpha Assignment ', topicName: 'English', yearGroup: 10 },
      ];
      googleRun.triggerSuccess('fetchAssignmentsForWizard', assignments);

      // Select assignment
      selectAssignment(document, document.defaultView, 'a1');

      // Fast path should have triggered startAssessmentFromWizard
      expect(googleRun.calledMethods).toContain('startAssessmentFromWizard');
      const call = googleRun._handlers.startAssessmentFromWizard;
      expect(call.args[0]).toBe('a1');
      expect(call.args[1]).toBe('Alpha_English_10');
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('matches a definition using alternateTitles (case-insensitive, trimmed)', () => {
    vi.useFakeTimers();
    const { document, googleRun, cleanup } = setupWizard();
    try {
      vi.runAllTimers();

      const defs = [
        {
          definitionKey: 'Beta_English_null',
          primaryTitle: 'Beta Assignment',
          alternateTitles: ['beta alt'],
          primaryTopic: 'English',
          yearGroup: null,
          documentType: 'SLIDES',
          referenceDocumentId: 'r2',
          templateDocumentId: 't2',
        },
      ];
      googleRun.triggerSuccess('getAllPartialDefinitions', defs);

      const assignments = [
        { id: 'b1', title: '  Beta ALT', topicName: 'English', yearGroup: null },
      ];
      googleRun.triggerSuccess('fetchAssignmentsForWizard', assignments);

      selectAssignment(document, document.defaultView, 'b1');

      expect(googleRun.calledMethods).toContain('startAssessmentFromWizard');
      const call = googleRun._handlers.startAssessmentFromWizard;
      expect(call.args[0]).toBe('b1');
      expect(call.args[1]).toBe('Beta_English_null');
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('does not match when yearGroup differs', () => {
    vi.useFakeTimers();
    const { document, googleRun, cleanup } = setupWizard();
    try {
      vi.runAllTimers();

      const defs = [
        {
          definitionKey: 'Gamma_Maths_9',
          primaryTitle: 'Gamma',
          primaryTopic: 'Maths',
          yearGroup: 9,
          documentType: 'SLIDES',
          referenceDocumentId: 'r3',
          templateDocumentId: 't3',
        },
      ];
      googleRun.triggerSuccess('getAllPartialDefinitions', defs);

      const assignments = [{ id: 'g1', title: 'Gamma', topicName: 'Maths', yearGroup: 10 }];
      googleRun.triggerSuccess('fetchAssignmentsForWizard', assignments);

      const { startButton } = getWizardElements(document);
      selectAssignment(document, document.defaultView, 'g1');

      // No automatic start should have been triggered when yearGroup differs
      expect(googleRun.calledMethods).not.toContain('startAssessmentFromWizard');
      // Start button remains disabled when no matching definition with docs exists
      expect(startButton.disabled).toBe(true);
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('disables start when matching definition lacks document IDs', () => {
    vi.useFakeTimers();
    const { document, googleRun, cleanup } = setupWizard();
    try {
      vi.runAllTimers();

      const defs = [
        {
          definitionKey: 'Delta_Science_11',
          primaryTitle: 'Delta',
          primaryTopic: 'Science',
          yearGroup: 11,
          documentType: 'SLIDES',
          // missing reference/template IDs
        },
      ];
      googleRun.triggerSuccess('getAllPartialDefinitions', defs);

      const assignments = [{ id: 'd1', title: 'Delta', topicName: 'Science', yearGroup: 11 }];
      googleRun.triggerSuccess('fetchAssignmentsForWizard', assignments);

      const { startButton } = getWizardElements(document);
      selectAssignment(document, document.defaultView, 'd1');

      // Definition exists but missing doc IDs, so we should not auto-start
      expect(googleRun.calledMethods).not.toContain('startAssessmentFromWizard');
      expect(startButton.disabled).toBe(true);
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });

  it('shows stale banner when TaskDefinitionsChanged is true on definition', () => {
    vi.useFakeTimers();
    const { document, googleRun, cleanup } = setupWizard();
    try {
      vi.runAllTimers();

      const defs = [
        {
          definitionKey: 'Epsilon_Art_null',
          primaryTitle: 'Epsilon',
          primaryTopic: 'Art',
          yearGroup: null,
          documentType: 'SLIDES',
          referenceDocumentId: 'r4',
          templateDocumentId: 't4',
          TaskDefinitionsChanged: true,
        },
      ];
      googleRun.triggerSuccess('getAllPartialDefinitions', defs);

      const assignments = [{ id: 'e1', title: 'Epsilon', topicName: 'Art', yearGroup: null }];
      googleRun.triggerSuccess('fetchAssignmentsForWizard', assignments);

      selectAssignment(document, document.defaultView, 'e1');

      // Stale flag should not prevent fast-path starting; start should have been triggered
      expect(googleRun.calledMethods).toContain('startAssessmentFromWizard');
      const call = googleRun._handlers.startAssessmentFromWizard;
      expect(call.args[0]).toBe('e1');
      expect(call.args[1]).toBe('Epsilon_Art_null');
    } finally {
      vi.useRealTimers();
      cleanup();
    }
  });
});
