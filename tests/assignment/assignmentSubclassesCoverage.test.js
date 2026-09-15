import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

// Hermetic behaviour coverage for Assignment sub-classes: timestamps, assessment
// base, LLM orchestration and student submission management. All GAS services
// are mocked; production modules are exercised through the globals seeded by
// tests/setupGlobals.js so coverage attributes to the canonical loader.

describe('Assignment timestamps behaviour', () => {
  it('touches, reads and clears updatedAt with defensive copying', () => {
    const assignment = { updatedAt: null, createdAt: null };
    const timestamps = new globalThis.AssignmentTimestamps(assignment);

    expect(timestamps.getUpdatedAt()).toBeNull();

    const touched = timestamps.touchUpdated();
    expect(touched).toBeInstanceOf(Date);
    expect(assignment.updatedAt).toBeInstanceOf(Date);

    const source = new Date('2026-03-04T05:06:07.000Z');
    const stored = timestamps.setUpdatedAt(source);
    expect(stored).toEqual(source);
    expect(stored).not.toBe(source);
    source.setFullYear(2001);
    expect(assignment.updatedAt.getFullYear()).toBe(2026);
    expect(timestamps.getUpdatedAt()).toBe(assignment.updatedAt);

    expect(timestamps.setUpdatedAt(null)).toBeNull();
    expect(assignment.updatedAt).toBeNull();
  });

  it('rejects invalid updatedAt values', () => {
    const timestamps = new globalThis.AssignmentTimestamps({ updatedAt: null });
    expect(() => timestamps.setUpdatedAt('tomorrow')).toThrow(TypeError);
    expect(() => timestamps.setUpdatedAt(new Date('not-a-date'))).toThrow(TypeError);
    expect(() => timestamps.setUpdatedAt(123)).toThrow(TypeError);
  });

  it('reads and writes createdAt with defensive copying', () => {
    const assignment = { createdAt: null };
    const timestamps = new globalThis.AssignmentTimestamps(assignment);

    const source = new Date('2025-05-06T07:08:09.000Z');
    const stored = timestamps.setCreatedAt(source);
    expect(stored).toEqual(source);
    expect(stored).not.toBe(source);
    expect(timestamps.getCreatedAt()).toBe(assignment.createdAt);
  });

  it('rejects invalid createdAt values', () => {
    const timestamps = new globalThis.AssignmentTimestamps({ createdAt: null });
    expect(() => timestamps.setCreatedAt(null)).toThrow(TypeError);
    expect(() => timestamps.setCreatedAt('2026-01-01')).toThrow(TypeError);
    expect(() => timestamps.setCreatedAt(new Date('bad'))).toThrow(TypeError);
  });
});

describe('Assignment assessment base behaviour', () => {
  it('requires subclass implementation for lifecycle methods', () => {
    const base = new globalThis.AssignmentAssessmentBase({ assignmentDefinition: null });
    expect(() => base.fetchSubmittedDocuments()).toThrow(
      'fetchSubmittedDocuments must be implemented by subclasses'
    );
    expect(() => base.populateTasks()).toThrow('populateTasks must be implemented by subclasses');
    expect(() => base.processAllSubmissions()).toThrow(
      'processAllSubmissions must be implemented by subclasses'
    );
    expect(() => base._requireImplementation('customMethod')).toThrow(
      'customMethod must be implemented by subclasses'
    );
  });

  it('reads tasks and document identifiers with null fallbacks', () => {
    const tasks = { t_one: { taskTitle: 'One' } };
    const base = new globalThis.AssignmentAssessmentBase({
      assignmentDefinition: {
        tasks,
        documentType: 'SLIDES',
        referenceDocumentId: 'ref-doc',
        templateDocumentId: 'tpl-doc',
      },
    });

    expect(base.getTasks()).toBe(tasks);
    expect(base.getDocumentType()).toBe('SLIDES');
    expect(base.getReferenceDocumentId()).toBe('ref-doc');
    expect(base.getTemplateDocumentId()).toBe('tpl-doc');

    const assigned = { t_two: { taskTitle: 'Two' } };
    expect(base.setTasks(assigned)).toBe(assigned);
    expect(base.getTasks()).toBe(assigned);
  });

  it('returns null when the assignment definition is absent', () => {
    const base = new globalThis.AssignmentAssessmentBase({});
    expect(base.getTasks()).toBeNull();
    expect(base.getDocumentType()).toBeNull();
    expect(base.getReferenceDocumentId()).toBeNull();
    expect(base.getTemplateDocumentId()).toBeNull();
  });
});

describe('Assignment LLM orchestration behaviour', () => {
  let restoreGlobals;
  let mockLogger;

  beforeEach(() => {
    mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => mockLogger }),
      LLMRequestManager: () => globalThis.LLMRequestManager,
      Utils: () => globalThis.Utils,
    });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  it('delegates request generation to a fresh manager', () => {
    const assignment = { assignmentId: 'a-one' };
    const requests = [{ studentId: 's-one' }];
    const generateRequestObjects = vi.fn(() => requests);
    class MockLLMManager {
      constructor() {
        this.generateRequestObjects = generateRequestObjects;
      }
    }
    globalThis.LLMRequestManager = MockLLMManager;

    const orchestration = new globalThis.AssignmentLLMOrchestration(assignment);
    expect(orchestration.generateLLMRequests()).toBe(requests);
    expect(generateRequestObjects).toHaveBeenCalledWith(assignment);
    expect(orchestration._getLLMManager()).toBeInstanceOf(globalThis.LLMRequestManager);
  });

  it('toasts and returns early when no requests exist', () => {
    const assignment = { assignmentId: 'a-two' };
    const processStudentResponses = vi.fn();
    class MockLLMManager {
      generateRequestObjects() {
        return [];
      }

      processStudentResponses(...args) {
        return processStudentResponses(...args);
      }
    }
    globalThis.LLMRequestManager = MockLLMManager;
    const toastMessage = vi.fn();
    globalThis.Utils = { toastMessage };

    const orchestration = new globalThis.AssignmentLLMOrchestration(assignment);
    orchestration.assessResponses();

    expect(toastMessage).toHaveBeenCalledWith('No LLM requests to send.', 'Info', 3);
    expect(processStudentResponses).not.toHaveBeenCalled();
  });

  it('toasts when the manager returns a null request list', () => {
    const assignment = { assignmentId: 'a-three' };
    class MockLLMManager {
      generateRequestObjects() {
        return null;
      }

      processStudentResponses() {}
    }
    globalThis.LLMRequestManager = MockLLMManager;
    const toastMessage = vi.fn();
    globalThis.Utils = { toastMessage };

    new globalThis.AssignmentLLMOrchestration(assignment).assessResponses();
    expect(toastMessage).toHaveBeenCalled();
  });

  it('processes responses when requests exist', () => {
    const assignment = { assignmentId: 'a-four' };
    const requests = [{ studentId: 's-nine' }];
    const processStudentResponses = vi.fn();
    class MockLLMManager {
      generateRequestObjects() {
        return requests;
      }

      processStudentResponses(...args) {
        return processStudentResponses(...args);
      }
    }
    globalThis.LLMRequestManager = MockLLMManager;
    globalThis.Utils = { toastMessage: vi.fn() };

    new globalThis.AssignmentLLMOrchestration(assignment).assessResponses();
    expect(processStudentResponses).toHaveBeenCalledWith(requests, assignment);
  });
});

describe('Assignment submissions behaviour', () => {
  let restoreGlobals;
  let mockLogger;

  beforeEach(() => {
    mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => mockLogger }),
      Classroom: () => globalThis.Classroom,
      DriveApp: () => globalThis.DriveApp,
    });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  it('returns null when the student id cannot be resolved', () => {
    const submissions = new globalThis.AssignmentSubmissions({ submissions: [] });
    expect(submissions.addStudent({})).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith('addStudent called without resolvable studentId');
  });

  it('resolves identifiers, avoids duplicates and keeps legacy metadata', () => {
    const assignment = { assignmentId: 'a-ten', submissions: [] };
    const submissions = new globalThis.AssignmentSubmissions(assignment);

    const first = submissions.addStudent({ id: 's-one', name: 'Student One' });
    expect(first.studentId).toBe('s-one');
    expect(first.studentName).toBe('Student One');
    expect(first._legacyStudent).toEqual({ id: 's-one', name: 'Student One' });
    expect(assignment.submissions).toHaveLength(1);

    expect(submissions.addStudent({ studentId: 's-one' })).toBe(first);
    expect(assignment.submissions).toHaveLength(1);

    const second = submissions.addStudent({ userId: 's-two', fullName: 'Second Student' });
    expect(second.studentId).toBe('s-two');
    expect(second.studentName).toBe('Second Student');

    const third = submissions.addStudent({ studentId: 's-three' });
    expect(third.studentName).toBeNull();
  });

  it('validates mime types by strict equality', () => {
    const submissions = new globalThis.AssignmentSubmissions({ submissions: [] });
    expect(submissions.isValidMimeType('type-a', 'type-a')).toBe(true);
    expect(submissions.isValidMimeType('type-a', 'type-b')).toBe(false);
  });

  it('ignores attachments without a drive file id', () => {
    const submissions = new globalThis.AssignmentSubmissions({ submissions: [] });
    submissions._processAttachmentForSubmission({}, 's-one', 'mime');
    submissions._processAttachmentForSubmission({ driveFile: {} }, 's-one', 'mime');
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Attachment for student ID s-one is not a Drive File or lacks a valid ID.'
    );
  });

  it('assigns matching submissions and touches the updated timestamp', () => {
    const touchUpdated = vi.fn();
    const assignment = {
      submissions: [{ studentId: 's-one', touchUpdated }],
    };
    globalThis.DriveApp = {
      getFileById: vi.fn(() => ({ getMimeType: () => 'mime-ok' })),
    };
    const submissions = new globalThis.AssignmentSubmissions(assignment);
    submissions._processAttachmentForSubmission(
      { driveFile: { id: 'file-one' } },
      's-one',
      'mime-ok'
    );
    expect(assignment.submissions[0].documentId).toBe('file-one');
    expect(touchUpdated).toHaveBeenCalled();
  });

  it('handles submissions without a touchUpdated helper', () => {
    const assignment = { submissions: [{ studentId: 's-one' }] };
    globalThis.DriveApp = {
      getFileById: vi.fn(() => ({ getMimeType: () => 'mime-ok' })),
    };
    const submissions = new globalThis.AssignmentSubmissions(assignment);
    submissions._processAttachmentForSubmission(
      { driveFile: { id: 'file-two' } },
      's-one',
      'mime-ok'
    );
    expect(assignment.submissions[0].documentId).toBe('file-two');
  });

  it('logs when no submission matches the student', () => {
    const assignment = { submissions: [] };
    globalThis.DriveApp = {
      getFileById: vi.fn(() => ({ getMimeType: () => 'mime-ok' })),
    };
    new globalThis.AssignmentSubmissions(assignment)._processAttachmentForSubmission(
      { driveFile: { id: 'file-three' } },
      'missing-student',
      'mime-ok'
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'No matching submission found for student ID: missing-student'
    );
  });

  it('logs unsupported mime types', () => {
    globalThis.DriveApp = {
      getFileById: vi.fn(() => ({ getMimeType: () => 'mime-other' })),
    };
    new globalThis.AssignmentSubmissions({ submissions: [] })._processAttachmentForSubmission(
      { driveFile: { id: 'file-four' } },
      's-one',
      'mime-ok'
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Attachment with Drive File ID file-four is not a supported document (MIME type: mime-other).'
    );
  });

  it('logs drive fetch failures without throwing', () => {
    const failure = new Error('drive unavailable');
    globalThis.DriveApp = {
      getFileById: vi.fn(() => {
        throw failure;
      }),
    };
    new globalThis.AssignmentSubmissions({ submissions: [] })._processAttachmentForSubmission(
      { driveFile: { id: 'file-five' } },
      's-one',
      'mime-ok'
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error fetching Drive file with ID file-five:',
      failure
    );
  });

  it('reports classroom fetch failures', () => {
    const failure = new Error('classroom down');
    globalThis.Classroom = {
      Courses: {
        CourseWork: {
          StudentSubmissions: {
            list: vi.fn(() => {
              throw failure;
            }),
          },
        },
      },
    };
    const submissions = new globalThis.AssignmentSubmissions({
      courseId: 'c-one',
      assignmentId: 'a-five',
      submissions: [],
    });
    submissions.fetchSubmittedDocumentsByMimeType('mime-ok');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error fetching submissions for assignment ID a-five:',
      failure
    );
  });

  it('reports empty classroom submission lists', () => {
    globalThis.Classroom = {
      Courses: { CourseWork: { StudentSubmissions: { list: vi.fn(() => ({})) } } },
    };
    const submissions = new globalThis.AssignmentSubmissions({
      courseId: 'c-one',
      assignmentId: 'a-six',
      submissions: [],
    });
    submissions.fetchSubmittedDocumentsByMimeType('mime-ok');
    expect(mockLogger.info).toHaveBeenCalledWith('No submissions found for assignment ID: a-six');

    globalThis.Classroom.Courses.CourseWork.StudentSubmissions.list.mockReturnValue({
      studentSubmissions: [],
    });
    submissions.fetchSubmittedDocumentsByMimeType('mime-ok');
    expect(mockLogger.info).toHaveBeenCalledTimes(2);
  });

  it('processes attachments and reports students without attachments', () => {
    const processSpy = vi.fn();
    const assignment = { courseId: 'c-two', assignmentId: 'a-seven', submissions: [] };
    const submissions = new globalThis.AssignmentSubmissions(assignment);
    submissions._processAttachmentForSubmission = processSpy;
    globalThis.Classroom = {
      Courses: {
        CourseWork: {
          StudentSubmissions: {
            list: vi.fn(() => ({
              studentSubmissions: [
                {
                  userId: 's-one',
                  assignmentSubmission: { attachments: [{ driveFile: { id: 'f-one' } }] },
                },
                { userId: 's-two' },
              ],
            })),
          },
        },
      },
    };
    submissions.fetchSubmittedDocumentsByMimeType('mime-ok');
    expect(processSpy).toHaveBeenCalledWith({ driveFile: { id: 'f-one' } }, 's-one', 'mime-ok');
    expect(mockLogger.info).toHaveBeenCalledWith('No attachments found for student ID: s-two');
  });
});
