import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { withTemporaryGlobals } from '#test-helpers/globalMockManager.js';
import { installAssignmentControllerCollaboratorMocks } from '../helpers/assignmentControllerCollaboratorMocks.js';
import { createFullDefinition } from './assignmentControllerTestHelpers.js';

// Setup global mocks
globalThis.ABLogger = require('#backend/Utils/ABLogger.js');
const DefinitionStaleError = require('#backend/Utils/ErrorTypes/DefinitionStaleError.js');

// Import classes after mocks
const AssignmentController = require('#backend/y_controllers/AssignmentController.js');

const Assignment = require('#backend/AssignmentProcessor/Assignment/index.js');

const { AssignmentDefinition } = require('#backend/Models/AssignmentDefinition.js');

describe('AssignmentController - Definition Hydration', () => {
  let mockDefinitionController;
  let mockABClassController;
  let mockProgressTracker;
  let loggerInstance;

  beforeEach(() => {
    vi.clearAllMocks();

    ({ mockDefinitionController, mockABClassController, mockProgressTracker, loggerInstance } =
      installAssignmentControllerCollaboratorMocks());

    // Mock Assignment factory and subclasses
    globalThis.Assignment = {
      create: vi.fn((definition) => {
        // Return appropriate mock based on documentType
        const instance = new globalThis.SlidesAssignment();
        instance.assignmentDefinition = definition;
        return instance;
      }),
    };

    globalThis.SlidesAssignment = vi.fn().mockImplementation(function () {
      this.assignmentDefinition = null;
      // Completed-run counting reads the persisted submission graph, so the stub
      // must expose the submissions structure a real assignment carries.
      this.submissions = [];
      this.populateTasks = vi.fn();
      this.fetchSubmittedDocuments = vi.fn();
      this.processAllSubmissions = vi.fn();
      this.processImages = vi.fn();
      this.assessResponses = vi.fn();
      this.touchUpdated = vi.fn();
      this.addStudent = vi.fn();
    });

    globalThis.Utils = {
      toastMessage: vi.fn(),
      generateHash: (str) => `hash_${(str || '').length}`,
    };
    globalThis.DateUtils = {
      isNewer: vi.fn().mockReturnValue(false),
      definitionNeedsRefresh: vi.fn().mockReturnValue(true),
    };

    // Mock DriveManager
    globalThis.DriveManager = {
      getFileModifiedTime: vi.fn().mockReturnValue('2025-01-01T00:00:00Z'),
    };
  });

  describe('processSelectedAssignment', () => {
    it('should fetch full definition from dedicated collection', () => {
      // Setup full definition
      const fullDefinition = createFullDefinition({
        primaryTitle: 'Essay 1',
        primaryTopic: 'English',
        referenceDocumentId: 'ref-123',
        templateDocumentId: 'tpl-456',
        tasks: {
          t1: {
            id: 't1',
            taskTitle: 'Introduction',
            pageId: 'p1',
            artifacts: {
              reference: [
                {
                  taskId: 't1',
                  role: 'reference',
                  content: 'full-content',
                  contentHash: 'hash123',
                },
              ],
            },
          },
        },
      });

      mockDefinitionController.getDefinitionByKey.mockReturnValue(fullDefinition);

      const controller = new AssignmentController();

      controller.processSelectedAssignment({
        assignmentId: 'assignment-1',
        definitionKey: 'Essay 1_English_year-group-10',
        courseId: 'course-1',
      });

      // Verify full definition fetched with correct form parameter
      expect(mockDefinitionController.getDefinitionByKey).toHaveBeenCalledWith(
        'Essay 1_English_year-group-10',
        { form: 'full' }
      );

      // Verify definition has full content
      const fetchedDef = mockDefinitionController.getDefinitionByKey.mock.results[0].value;
      expect(fetchedDef.tasks.t1.artifacts.reference[0].content).toBe('full-content');
      expect(fetchedDef.tasks.t1.artifacts.reference[0].contentHash).toBe('hash123');
    });

    it('should throw error if definition not found', () => {
      mockDefinitionController.getDefinitionByKey.mockReturnValue(null);

      const controller = new AssignmentController();

      expect(() => {
        controller.processSelectedAssignment({
          assignmentId: 'assignment-1',
          definitionKey: 'NonExistent_Topic_year-group-10',
          courseId: 'course-1',
        });
      }).toThrow('Assignment definition not found for key NonExistent_Topic_year-group-10');
    });

    it('should use full definition for assignment instance creation', () => {
      const fullDefinition = createFullDefinition();

      mockDefinitionController.getDefinitionByKey.mockReturnValue(fullDefinition);

      const controller = new AssignmentController();
      controller.processSelectedAssignment({
        assignmentId: 'assignment-1',
        definitionKey: 'Test_Topic_year-group-10',
        courseId: 'course-1',
      });

      // Verify SlidesAssignment was created (based on documentType)
      expect(globalThis.SlidesAssignment).toHaveBeenCalled();
    });
  });

  describe('runAssignmentPipeline', () => {
    it('should throw DefinitionStaleError when definition is stale', () => {
      const definition = new AssignmentDefinition({
        primaryTitle: 'Test',
        primaryTopic: 'Topic',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        referenceLastModified: '2024-01-01T00:00:00Z',
        templateLastModified: '2024-01-01T00:00:00Z',
        tasks: {},
      });

      const mockAssignment = new globalThis.SlidesAssignment();
      mockAssignment.assignmentDefinition = definition;

      globalThis.DateUtils.isNewer.mockReturnValue(true);

      const controller = new AssignmentController();

      // Should throw DefinitionStaleError when stale
      expect(() => {
        controller.runAssignmentPipeline(mockAssignment, [{ id: 's1', name: 'Student 1' }], {
          includeImages: true,
          definitionController: mockDefinitionController,
        });
      }).toThrow(DefinitionStaleError);
    });

    it('should skip parsing if definition is fresh', () => {
      const definition = new AssignmentDefinition({
        primaryTitle: 'Test',
        primaryTopic: 'Topic',
        yearGroupKey: 'year-group-10',
        yearGroupLabel: 'Year 10',
        documentType: 'SLIDES',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
        referenceLastModified: '2025-01-01T00:00:00Z',
        templateLastModified: '2025-01-01T00:00:00Z',
        tasks: {
          t1: { taskTitle: 'Task 1', pageId: 'p1', artifacts: { reference: [], template: [] } },
        },
      });

      const mockAssignment = new globalThis.SlidesAssignment();
      mockAssignment.assignmentDefinition = definition;

      globalThis.DateUtils.definitionNeedsRefresh.mockReturnValue(false);

      const controller = new AssignmentController();
      controller.runAssignmentPipeline(mockAssignment, [{ id: 's1', name: 'Student 1' }], {
        includeImages: true,
        definitionController: mockDefinitionController,
      });

      // Should NOT call populateTasks when fresh
      expect(mockAssignment.populateTasks).not.toHaveBeenCalled();

      // Should proceed with other pipeline steps
      expect(mockAssignment.processAllSubmissions).toHaveBeenCalled();
    });
  });
});

describe('AssignmentController - completed-run failed-item counting', () => {
  /**
   * Restores a real canonical completed assignment so the counter runs over the graph
   * the completed-write gate is meant to establish, not a hand-built stub. The enclosing
   * suite stubs the Assignment subclasses for orchestration tests, so the real
   * polymorphic subclasses are installed for the duration of the restoration only.
   * @returns {Assignment} A freshly restored, independently owned full assignment.
   */
  const restoreCanonicalAssignment = () => {
    const inputs = loadBackendModelInputs('medium');
    const record = structuredClone(inputs.assignmentsByKey['assignment-0-4']);
    return withTemporaryGlobals(
      {
        Assignment: () => require('#backend/AssignmentProcessor/Assignment/index.js'),
        SlidesAssignment: () => require('#backend/AssignmentProcessor/SlidesAssignment.js'),
        SheetsAssignment: () => require('#backend/AssignmentProcessor/SheetsAssignment.js'),
      },
      () => Assignment.fromJSON(record, 'full')
    );
  };

  /** Picks a submission that genuinely carries a document, so its items are meaningful. */
  const documentBearingSubmission = (assignment) =>
    assignment.submissions.find((submission) => submission.documentId !== null);

  it('counts each failed item once for a healthy restored canonical assignment', () => {
    const controller = new AssignmentController();
    const assignment = restoreCanonicalAssignment();

    // Canonical medium assignment-0-4 carries four all-three-E items and twelve E
    // criteria in total, so this pins once-per-item counting rather than per-criterion.
    expect(controller._countFailedSubmissionItems(assignment)).toBe(4);
  });

  it('fails loudly when the submissions structure is missing', () => {
    const controller = new AssignmentController();
    const assignment = restoreCanonicalAssignment();
    delete assignment.submissions;

    expect(() => controller._countFailedSubmissionItems(assignment)).toThrow(/submissions/i);
  });

  it('fails loudly when a document-bearing submission is missing its items structure', () => {
    const controller = new AssignmentController();
    const assignment = restoreCanonicalAssignment();
    delete documentBearingSubmission(assignment).items;

    expect(() => controller._countFailedSubmissionItems(assignment)).toThrow(/items/i);
  });

  it('fails loudly when an item is missing its assessments structure', () => {
    const controller = new AssignmentController();
    const assignment = restoreCanonicalAssignment();
    const items = documentBearingSubmission(assignment).items;
    delete Object.values(items)[0].assessments;

    expect(() => controller._countFailedSubmissionItems(assignment)).toThrow(/assessments/i);
  });
});
