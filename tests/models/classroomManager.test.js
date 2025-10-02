import { describe, it, expect, beforeAll } from 'vitest';

// Import the setupGlobals to ensure global mocks are available
if (!global.Utils || !global.Utilities) {
  throw new Error('Global Utils/Utilities expected from setupGlobals.js');
}

describe('ClassroomManager', () => {
  let ClassroomManager;
  let Student;

  beforeAll(() => {
    // Mock the global Classroom API for testing
    global.Classroom = {
      Courses: {
        Students: {
          list: (courseId, params) => {
            // Mock response with students data
            const mockStudents = [
              {
                profile: {
                  id: 'student1',
                  name: { fullName: 'John Doe' },
                  emailAddress: 'john.doe@example.com',
                },
              },
              {
                profile: {
                  id: 'student2',
                  name: { fullName: 'Jane Smith' },
                  emailAddress: 'jane.smith@example.com',
                },
              },
            ];

            return {
              students: mockStudents,
              nextPageToken: null, // No pagination for this test
            };
          },
        },
      },
    };

    // Load the Student class first
    const StudentExport = require('../../src/AdminSheet/Models/Student.js');
    Student = StudentExport.Student || StudentExport;
    global.Student = Student;

    // Load the ClassroomApiClient class (merged implementation)
    const ClassroomApiClientExport = require('../../src/AdminSheet/GoogleClassroom/ClassroomApiClient.js');
    ClassroomManager = ClassroomApiClientExport.ClassroomApiClient || ClassroomApiClientExport;
  });

  it('fetchAllStudents should return array of Student instances', () => {
    const courseId = 'test-course-id';
    const students = ClassroomManager.fetchAllStudents(courseId);

    expect(Array.isArray(students)).toBe(true);
    expect(students.length).toBe(2);

    // Verify the first student
    expect(students[0]).toBeInstanceOf(Student);
    expect(students[0].name).toBe('John Doe');
    expect(students[0].email).toBe('john.doe@example.com');
    expect(students[0].id).toBe('student1');

    // Verify the second student
    expect(students[1]).toBeInstanceOf(Student);
    expect(students[1].name).toBe('Jane Smith');
    expect(students[1].email).toBe('jane.smith@example.com');
    expect(students[1].id).toBe('student2');
  });

  it('fetchAllStudents should handle empty course gracefully', () => {
    // Mock empty response
    global.Classroom.Courses.Students.list = () => ({
      students: [],
      nextPageToken: null,
    });

    const courseId = 'empty-course-id';
    const students = ClassroomManager.fetchAllStudents(courseId);

    expect(Array.isArray(students)).toBe(true);
    expect(students.length).toBe(0);
  });
});
