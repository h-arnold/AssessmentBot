import { beforeEach, afterEach, vi } from 'vitest';

// Path to the module under test. Kept in one place so every ClassroomApiClient
// suite reloads the same file with the same require.cache reset.
export const classroomApiClientModulePath =
  '../../src/backend/GoogleClassroom/ClassroomApiClient.js';

// setupGlobals.js installs a lightweight ProgressTracker. Fail loudly when a
// suite is run without that base environment.
export function assertProgressTrackerMockAvailable() {
  if (!globalThis.ProgressTracker) {
    throw new Error('ProgressTracker mock expected from setupGlobals.js');
  }
}

/**
 * Creates the shared global-mock lifecycle for one ClassroomApiClient suite.
 * The returned harness registers its own beforeEach/afterEach hooks and exposes
 * the doubles each suite reads from its test bodies. Each suite opts into only
 * the globals it replaces, so the save/restore set matches the original setup.
 *
 * @param {Object} options Harness configuration.
 * @param {Function} options.classroomFactory Builds a fresh Classroom global.
 * @param {boolean} [options.installProgressTracker] Mock ProgressTracker.getInstance.
 * @param {boolean} [options.installTeacherAndStudent] Install Teacher and Student models.
 * @param {boolean} [options.withInfoLogger] Give the ABLogger double an info method.
 * @returns {Object} The harness holding the freshly loaded module and doubles.
 */
export function createClassroomApiClientHarness(options) {
  const {
    classroomFactory,
    installProgressTracker = false,
    installTeacherAndStudent = false,
    withInfoLogger = false,
  } = options;

  const harness = {};
  let originalProgressTrackerGetInstance;
  let originalABLogger;
  let originalClassroom;
  let originalTeacher;
  let originalStudent;

  beforeEach(() => {
    if (installProgressTracker) {
      originalProgressTrackerGetInstance = globalThis.ProgressTracker.getInstance;
    }
    originalABLogger = globalThis.ABLogger;
    originalClassroom = globalThis.Classroom;
    if (installTeacherAndStudent) {
      originalTeacher = globalThis.Teacher;
      originalStudent = globalThis.Student;
    }

    if (installProgressTracker) {
      harness.progressTrackerInstance = {
        logAndThrowError: vi.fn((message) => {
          throw new Error(message);
        }),
        logError: vi.fn(),
      };
      globalThis.ProgressTracker.getInstance = vi.fn(() => harness.progressTrackerInstance);
    }

    const abLoggerInstance = withInfoLogger
      ? { info: vi.fn(), error: vi.fn() }
      : { error: vi.fn() };
    harness.abLoggerInstance = abLoggerInstance;
    harness.abLoggerErrorSpy = abLoggerInstance.error;
    globalThis.ABLogger = { getInstance: vi.fn(() => abLoggerInstance) };

    globalThis.Classroom = classroomFactory();

    if (installTeacherAndStudent) {
      const teacherExport = require('#backend/Models/Teacher.js');
      globalThis.Teacher = teacherExport.Teacher || teacherExport;
      const studentExport = require('#backend/Models/Student.js');
      globalThis.Student = studentExport.Student || studentExport;
    }

    delete require.cache[require.resolve(classroomApiClientModulePath)];
    const exported = require(classroomApiClientModulePath);
    harness.ClassroomApiClient = exported.ClassroomApiClient || exported;
  });

  afterEach(() => {
    if (installProgressTracker) {
      globalThis.ProgressTracker.getInstance = originalProgressTrackerGetInstance;
    }
    globalThis.ABLogger = originalABLogger;
    globalThis.Classroom = originalClassroom;
    if (installTeacherAndStudent) {
      globalThis.Teacher = originalTeacher;
      globalThis.Student = originalStudent;
    }
    vi.restoreAllMocks();
  });

  return harness;
}
