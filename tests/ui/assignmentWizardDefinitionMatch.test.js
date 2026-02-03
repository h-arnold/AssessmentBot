import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  buildAssignment,
  buildDefinition,
  getWizardElements,
  seedWizardData,
  selectAssignment,
  setupWizard,
} from '../helpers/assessmentWizardTestUtils.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function withWizard(testFn) {
  vi.useFakeTimers();
  const context = setupWizard();
  try {
    vi.runAllTimers();
    testFn(context);
  } finally {
    vi.useRealTimers();
    context.cleanup();
  }
}

describe('Assessment wizard definition matching', () => {
  it('matches a definition by primaryTitle/topic/yearGroup and enables fast-start when doc IDs present', () => {
    withWizard(({ document, googleRun }) => {
      const defs = [
        buildDefinition({
          definitionKey: 'Alpha_English_10',
          primaryTitle: 'Alpha Assignment',
          primaryTopic: 'English',
          yearGroup: 10,
          referenceDocumentId: 'r1',
          templateDocumentId: 't1',
        }),
      ];
      const assignments = [
        buildAssignment({
          id: 'a1',
          title: 'Alpha Assignment ',
          topicName: 'English',
          yearGroup: 10,
        }),
      ];

      seedWizardData(googleRun, { definitions: defs, assignments });
      selectAssignment(document, document.defaultView, 'a1');

      expect(googleRun.calledMethods).toContain('startAssessmentFromWizard');
      const call = googleRun._handlers.startAssessmentFromWizard;
      expect(call.args[0]).toBe('a1');
      expect(call.args[1]).toBe('Alpha_English_10');
    });
  });

  it('matches a definition using alternateTitles (case-insensitive, trimmed)', () => {
    withWizard(({ document, googleRun }) => {
      const defs = [
        buildDefinition({
          definitionKey: 'Beta_English_null',
          primaryTitle: 'Beta Assignment',
          alternateTitles: ['beta alt'],
          primaryTopic: 'English',
          yearGroup: null,
          referenceDocumentId: 'r2',
          templateDocumentId: 't2',
        }),
      ];
      const assignments = [
        buildAssignment({
          id: 'b1',
          title: '  Beta ALT',
          topicName: 'English',
          yearGroup: null,
        }),
      ];

      seedWizardData(googleRun, { definitions: defs, assignments });
      selectAssignment(document, document.defaultView, 'b1');

      expect(googleRun.calledMethods).toContain('startAssessmentFromWizard');
      const call = googleRun._handlers.startAssessmentFromWizard;
      expect(call.args[0]).toBe('b1');
      expect(call.args[1]).toBe('Beta_English_null');
    });
  });

  it('does not match when yearGroup differs', () => {
    withWizard(({ document, googleRun }) => {
      const defs = [
        buildDefinition({
          definitionKey: 'Gamma_Maths_9',
          primaryTitle: 'Gamma',
          primaryTopic: 'Maths',
          yearGroup: 9,
          referenceDocumentId: 'r3',
          templateDocumentId: 't3',
        }),
      ];
      const assignments = [
        buildAssignment({ id: 'g1', title: 'Gamma', topicName: 'Maths', yearGroup: 10 }),
      ];

      seedWizardData(googleRun, { definitions: defs, assignments });

      const { startButton } = getWizardElements(document);
      selectAssignment(document, document.defaultView, 'g1');

      expect(googleRun.calledMethods).not.toContain('startAssessmentFromWizard');
      expect(startButton.disabled).toBe(true);
    });
  });

  it('disables start when matching definition lacks document IDs', () => {
    withWizard(({ document, googleRun }) => {
      const defs = [
        buildDefinition({
          definitionKey: 'Delta_Science_11',
          primaryTitle: 'Delta',
          primaryTopic: 'Science',
          yearGroup: 11,
          referenceDocumentId: '',
          templateDocumentId: '',
        }),
      ];
      const assignments = [
        buildAssignment({ id: 'd1', title: 'Delta', topicName: 'Science', yearGroup: 11 }),
      ];

      seedWizardData(googleRun, { definitions: defs, assignments });

      const { startButton } = getWizardElements(document);
      selectAssignment(document, document.defaultView, 'd1');

      expect(googleRun.calledMethods).not.toContain('startAssessmentFromWizard');
      expect(startButton.disabled).toBe(true);
    });
  });

  it('shows stale banner when TaskDefinitionsChanged is true on definition', () => {
    withWizard(({ document, googleRun }) => {
      const defs = [
        buildDefinition({
          definitionKey: 'Epsilon_Art_null',
          primaryTitle: 'Epsilon',
          primaryTopic: 'Art',
          yearGroup: null,
          referenceDocumentId: 'r4',
          templateDocumentId: 't4',
          TaskDefinitionsChanged: true,
        }),
      ];
      const assignments = [
        buildAssignment({ id: 'e1', title: 'Epsilon', topicName: 'Art', yearGroup: null }),
      ];

      seedWizardData(googleRun, { definitions: defs, assignments });
      selectAssignment(document, document.defaultView, 'e1');

      expect(googleRun.calledMethods).toContain('startAssessmentFromWizard');
      const call = googleRun._handlers.startAssessmentFromWizard;
      expect(call.args[0]).toBe('e1');
      expect(call.args[1]).toBe('Epsilon_Art_null');
    });
  });
});
