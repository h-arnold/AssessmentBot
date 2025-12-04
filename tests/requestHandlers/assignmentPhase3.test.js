import { describe, it, expect, beforeEach } from 'vitest';

// Import model classes from source (CommonJS exports)
const { TaskDefinition } = require('../../src/AdminSheet/Models/TaskDefinition.js');
const { StudentSubmission } = require('../../src/AdminSheet/Models/StudentSubmission.js');

// Import shared test helpers
const { simpleHash } = require('../helpers/testUtils.js');
const {
  createTextTask,
  setupGlobalDummyClasses,
  createDummyConfigurationManager,
  DummyCacheManager,
  DummyBaseRequestManager,
  createSlidesAssignment,
} = require('../helpers/modelFactories.js');

// Minimal global Utils & dependencies stubs required by artifacts & manager (non-GAS)
global.Utils = {
  generateHash: simpleHash,
  normaliseKeysToLowerCase: (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const out = {};
    Object.keys(obj).forEach((k) => {
      out[k.toLowerCase()] = obj[k];
    });
    return out;
  },
  toastMessage: () => {},
};

// Setup global dummy classes
setupGlobalDummyClasses();

// Override specific globals for this test (use the classes directly)
global.BaseRequestManager = DummyBaseRequestManager;
global.CacheManager = DummyCacheManager;

// Provide globals expected by Assignment constructor
global.Classroom = {
  Courses: {
    CourseWork: {
      get: () => ({ title: 'Stubbed Assignment' }),
      StudentSubmissions: { list: () => ({ studentSubmissions: [] }) },
    },
  },
};
global.DriveApp = {
  getFileById: () => ({ getMimeType: () => 'application/vnd.google-apps.slides' }),
};
global.MimeType = {
  GOOGLE_SLIDES: 'application/vnd.google-apps.slides',
  GOOGLE_SHEETS: 'application/vnd.google-apps.spreadsheet',
};
global.StudentSubmission = StudentSubmission;

// Now that globals exist, require runtime-dependent classes
const LLMRequestManagerFresh = require('../../src/AdminSheet/RequestHandlers/LLMRequestManager.js');

describe('Phase 3 LLMRequestManager integration (new model)', () => {
  let assignment, manager;

  beforeEach(() => {
    assignment = createSlidesAssignment({
      courseId: 'course1',
      assignmentId: 'assign1',
      referenceDocumentId: 'ref-slides-1',
      templateDocumentId: 'tpl-slides-1',
      assignmentName: 'Test Assignment',
    });

    // Inject tasks
    const td1 = createTextTask(1, 'Reference Answer', 'Template Text');
    const td2 = createTextTask(2, 'Another Ref', 'Another Template');
    const tdSpreadsheet = new TaskDefinition({ taskTitle: 'Sheet', pageId: 's1', index: 3 });
    tdSpreadsheet.addReferenceArtifact({ type: 'SPREADSHEET', content: [['=sum(a1:a2)']] });
    tdSpreadsheet.addTemplateArtifact({ type: 'SPREADSHEET', content: [['=sum(a1:a2)']] });
    assignment.tasks = {
      [td1.getId()]: td1,
      [td2.getId()]: td2,
      [tdSpreadsheet.getId()]: tdSpreadsheet,
    };

    // Add a student & create submission entries
    const sub = assignment.addStudent({ id: 'stud1', name: 'Student One' });
    sub.documentId = 'doc1';

    // Upsert submission items for td1 & td2 with distinct content
    sub.upsertItemFromExtraction(td1, { content: 'Student response 1' });
    sub.upsertItemFromExtraction(td2, { content: 'Another student answer' });
    // For spreadsheet, upsert identical to template to verify skip (and type skip)
    sub.upsertItemFromExtraction(tdSpreadsheet, { content: [['=sum(A1:A2)']] });

    manager = new LLMRequestManagerFresh();
    manager.configManager = createDummyConfigurationManager();
  });

  it('generates requests only for non-spreadsheet items', () => {
    const reqs = manager.generateRequestObjects(assignment);
    expect(reqs.length).toBe(2); // text tasks only
    reqs.forEach((r) => {
      const payload = JSON.parse(r.payload);
      expect(['TEXT']).toContain(payload.taskType); // ensure uppercase type
    });
  });

  it('marks not-attempted when student hash equals template hash', () => {
    // Make a new task where student copies template exactly
    const tdCopy = createTextTask(4, 'Ref X', 'Template Y');
    assignment.tasks[tdCopy.getId()] = tdCopy;
    const sub = assignment.submissions[0];
    sub.upsertItemFromExtraction(tdCopy, { content: 'Template Y' }); // identical to template
    const manager2 = new LLMRequestManagerFresh();
    manager2.configManager = createDummyConfigurationManager();
    const reqs = manager2.generateRequestObjects(assignment);
    // Original 2 + copied task excluded due to not-attempted -> still 2
    expect(reqs.length).toBe(2);
    // Ensure assessment data placed (N) on copied task
    const item = sub.getItem(tdCopy.getId());
    const assessments = item.getAssessment();
    // Not attempted sets score "N"
    expect(Object.values(assessments).every((a) => a.score === 'N')).toBe(true);
  });

  it('uses cache to skip generating duplicate request', () => {
    // First run generates and caches for task 1
    const reqs1 = manager.generateRequestObjects(assignment);
    expect(reqs1.length).toBe(2);
    // Simulate processing and caching result manually
    const sub = assignment.submissions[0];
    const item1 = sub.getItem(Object.keys(assignment.tasks)[0]);
    const td1 = assignment.tasks[item1.taskId];
    const refHash = td1.getPrimaryReference().contentHash;
    const respHash = item1.artifact.contentHash;
    manager.cacheManager.setCachedAssessment(refHash, respHash, {
      completeness: { score: 5, reasoning: 'cache' },
      accuracy: { score: 5, reasoning: 'cache' },
      spag: { score: 5, reasoning: 'cache' },
    });
    // Re-run request generation; cached task removed -> still 2? we need to modify a second item to test skip.
    // Modify second item content to force new hash so only first task is cached
    const secondItem = sub.getItem(Object.keys(assignment.tasks)[1]);
    secondItem.artifact.content = 'Different now';
    secondItem.artifact.ensureHash();
    const reqs2 = manager.generateRequestObjects(assignment);
    // One task cached, one new text request
    expect(reqs2.length).toBe(1);
  });

  it('processStudentResponses assigns assessments to items', () => {
    const reqs = manager.generateRequestObjects(assignment);
    manager.processStudentResponses(reqs, assignment);
    const sub = assignment.submissions[0];
    const assessedItems = Object.values(sub.items).filter((i) => i.getType() !== 'SPREADSHEET');
    assessedItems.forEach((item) => {
      const a = item.getAssessment();
      expect(a.completeness.score).toBeTypeOf('number');
      expect(a.accuracy.score).toBeTypeOf('number');
      expect(a.spag.score).toBeTypeOf('number');
    });
  });

  it('processStudentResponses caches successful assessments', () => {
    // Ensure no cache present initially
    const sub = assignment.submissions[0];
    const itemEntries = Object.values(sub.items).filter((i) => i.getType() !== 'SPREADSHEET');
    expect(itemEntries.length).toBeGreaterThan(0);

    // Generate requests and process responses
    const reqs = manager.generateRequestObjects(assignment);
    manager.processStudentResponses(reqs, assignment);

    // After processing, each non-spreadsheet item should have a cached entry
    itemEntries.forEach((item) => {
      const td = assignment.tasks[item.taskId];
      const refHash = td.getPrimaryReference().contentHash;
      const respHash = item.artifact.contentHash;
      const cached = manager.cacheManager.getCachedAssessment(refHash, respHash);
      expect(cached).not.toBeNull();
      ['completeness', 'accuracy', 'spag'].forEach((criterion) => {
        expect(cached).toHaveProperty(criterion);
        const payload = cached[criterion];
        expect(typeof payload.score).toBe('number');
        expect(typeof payload.reasoning).toBe('string');
      });
    });
  });

  it('caches assessments after retry succeeds', () => {
    const reqs = manager.generateRequestObjects(assignment);
    expect(reqs.length).toBeGreaterThan(0);

    const retryRequest = reqs[0];
    const retryResponse = {
      getResponseCode: () => 200,
      getContentText: () =>
        JSON.stringify({
          completeness: { score: 10, reasoning: 'retry' },
          accuracy: { score: 9, reasoning: 'retry' },
          spag: { score: 8, reasoning: 'retry' },
        }),
    };
    manager.sendRequestWithRetries = () => retryResponse;

    manager.handleValidationFailure(retryRequest.uid, retryRequest, assignment);

    const { item, taskDef } = manager.uidIndex[retryRequest.uid];
    const refHash = taskDef.getPrimaryReference().contentHash;
    const respHash = item.artifact.contentHash;
    const cached = manager.cacheManager.getCachedAssessment(refHash, respHash);
    expect(cached).not.toBeNull();
    ['completeness', 'accuracy', 'spag'].forEach((criterion) => {
      expect(cached[criterion]).toMatchObject({
        score: expect.any(Number),
        reasoning: expect.any(String),
      });
    });
  });
});
