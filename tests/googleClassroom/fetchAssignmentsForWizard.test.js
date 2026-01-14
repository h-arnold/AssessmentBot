import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const globalsPath = path.resolve(__dirname, '../../src/AdminSheet/GoogleClassroom/globals.js');
const globalsSource = fs.readFileSync(globalsPath, 'utf8');

function loadGlobals({ assignments, courseId }) {
  const GoogleClassroomManager = class {
    getAssignments(id) {
      if (id !== courseId) {
        throw new Error('Unexpected courseId');
      }
      return assignments;
    }
  };

  const ConfigurationManager = class {
    static getInstance() {
      return {
        getAssessmentRecordCourseId() {
          return courseId;
        },
      };
    }
  };

  const sandbox = {
    GoogleClassroomManager,
    ConfigurationManager,
  };

  const context = vm.createContext(sandbox);
  new vm.Script(globalsSource, { filename: globalsPath }).runInContext(context);
  return { context };
}

describe('fetchAssignmentsForWizard', () => {
  it('returns id, title, and topicName for each assignment', () => {
    const assignments = [
      { id: 'a1', title: 'Assignment 1', topicName: 'Topic A' },
      { id: 'a2', title: 'Assignment 2', topicName: 'Topic B' },
    ];

    const { context } = loadGlobals({ assignments, courseId: 'course-1' });

    const result = context.fetchAssignmentsForWizard();
    expect(result).toEqual([
      { id: 'a1', title: 'Assignment 1', topicName: 'Topic A' },
      { id: 'a2', title: 'Assignment 2', topicName: 'Topic B' },
    ]);
  });

  it('throws when no classroom is selected', () => {
    const assignments = [];
    const { context } = loadGlobals({ assignments, courseId: '' });

    expect(() => context.fetchAssignmentsForWizard()).toThrow(
      'No classroom selected. Please select a classroom first.'
    );
  });
});
