import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import { createCanonicalMetadataFixture } from './abClassMetadataSharedFixtures';

/** Constructor-owned defaults shared by focused full-class fixture builders. */
export class ClassFullFixtureDefaults {
  readonly classId: string;
  readonly className: ClassFull['className'];
  readonly students: ClassFull['students'];
  readonly assignments: ClassFull['assignments'];
  readonly metadata: ClassFull['metadata'];
  readonly cohortKey: ClassFull['cohortKey'];
  readonly courseLength: ClassFull['courseLength'];
  readonly yearGroupKey: ClassFull['yearGroupKey'];
  readonly classOwner: ClassFull['classOwner'];
  readonly teachers: ClassFull['teachers'];
  readonly active: ClassFull['active'];

  /**
   * Applies defaults only to absent/undefined overrides, preserving explicit null.
   * @param {Partial<ClassFull>} overrides - Caller-owned boundary or realistic fields.
   */
  constructor(overrides: Partial<ClassFull>) {
    this.classId = overrides.classId ?? 'c-1';
    this.className = overrides.className === undefined ? 'Test Class' : overrides.className;
    this.students = overrides.students ?? [];
    this.assignments = overrides.assignments ?? [];
    this.cohortKey = null;
    this.courseLength = 1;
    this.yearGroupKey = 'yg-10';
    this.classOwner = null;
    this.teachers = [];
    this.active = null;
    this.metadata =
      overrides.metadata === undefined ? createCanonicalMetadataFixture() : overrides.metadata;
  }
}
