import {
  AssignmentFullSchema,
  StudentSubmissionItemSchema,
  type AssignmentFull,
  StudentSubmissionSchema,
} from './assignmentAssessment.zod';
import {
  AssignmentPartialSchema,
  ClassFullSchema,
  StudentSubmissionItemPartialSchema,
  StudentSubmissionPartialSchema,
} from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import { logFrontendEvent } from '@/logging/frontendLogger';
import {
  corruptItem,
  isIdentity,
  isRecord,
  isValidFullItem as validateFullItem,
  isValidPartialItem as validatePartialItem,
  itemErrorPath,
} from './assignmentReadItemValidation';

const criteria = ['completeness', 'accuracy', 'spag'] as const;
const corrupt = {
  score: 'E',
  reasoning: 'The stored assessment data for this task is invalid. Reassess the assignment.',
  error: { stage: 'validation', code: 'CORRUPT_RECORD' },
};
const corruptMap = Object.fromEntries(criteria.map((key) => [key, corrupt]));
const fullRootSchema = AssignmentFullSchema.omit({ submissions: true }).strict();
const classRootSchema = ClassFullSchema.omit({ assignments: true });
const fullAssignmentRootSchema = AssignmentPartialSchema.omit({ submissions: true });

/** Copies a root without its separately validated collection.
 * @param {Record<string, unknown>} value Root record.
 * @param {string} field Collection field to omit.
 * @returns {Record<string, unknown>} Detached root without the field.
 */
function withoutField(value: Record<string, unknown>, field: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== field));
}

/** Serialises supplied projections with object keys sorted at every depth.
 * @param {unknown} value Candidate JSON value.
 * @returns {string} Deterministic structural representation.
 */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

/** Validates a supplied task dictionary against its canonical keyed IDs.
 * @param {Record<string, unknown>} tasks Candidate task dictionary.
 * @returns {boolean} Whether each task ID agrees with its dictionary key.
 */
function hasCanonicalTaskIds(tasks: Record<string, unknown>): boolean {
  return Object.entries(tasks).every(([key, task]) => isRecord(task) && task.id === key);
}

type FullRootValidationContext = Pick<AssignmentFull, 'courseId' | 'assignmentId'> & {
  tasks: Record<string, unknown> | null;
  assignmentDefinition: { definitionKey: string; tasks: Record<string, unknown> };
};

/** Validates full root identities and both supplied task projections.
 * @param {FullRootValidationContext} root Parsed full assignment root fields.
 * @returns {boolean} Whether the root has one trustworthy task universe.
 */
function hasConsistentFullRoot(root: FullRootValidationContext): boolean {
  const tasks = root.tasks;
  const definitionTasks = root.assignmentDefinition.tasks;
  return (
    isIdentity(root.courseId) &&
    isIdentity(root.assignmentId) &&
    isIdentity(root.assignmentDefinition.definitionKey) &&
    isRecord(tasks) &&
    hasCanonicalTaskIds(tasks) &&
    hasCanonicalTaskIds(definitionTasks) &&
    stableJson(tasks) === stableJson(definitionTasks)
  );
}

/**
 * Logs only safe item identifiers and a field path.
 * @param {Record<string, string>} context Safe contextual identifiers.
 * @param {string} path Invalid field path.
 */
function diagnostic(context: Record<string, string>, path: string): void {
  logFrontendEvent('warn', {
    context: 'assignmentReadNormalisation',
    errorMessage: 'Invalid identifiable assignment item was isolated.',
    metadata: { fieldPath: path, ...context },
  });
}

/**
 * Validates a full item and its contextual source state.
 * @param {unknown} item Candidate item.
 * @param {string} key Dictionary task key.
 * @param {unknown} parentDocumentId Parent source identity.
 * @returns {boolean} Whether the item is valid.
 */
function isValidFullItem(item: unknown, key: string, parentDocumentId: unknown): boolean {
  return validateFullItem(item, key, parentDocumentId, StudentSubmissionItemSchema);
}

/**
 * Validates a partial item and its contextual source state.
 * @param {unknown} item Candidate item.
 * @param {string} key Dictionary task key.
 * @param {unknown} parentDocumentId Parent source identity.
 * @returns {boolean} Whether the item is valid.
 */
function isValidPartialItem(item: unknown, key: string, parentDocumentId: unknown): boolean {
  return validatePartialItem(item, key, parentDocumentId, StudentSubmissionItemPartialSchema);
}

type FullAssignmentContext = Pick<
  AssignmentFull,
  'courseId' | 'assignmentId' | 'assessmentContractVersion'
>;

/** Normalises one identified full submission and its task entries.
 * @param {unknown} rawSubmission Candidate submission.
 * @param {number} submissionIndex Submission position for diagnostics.
 * @param {FullAssignmentContext} root Validated assignment context.
 * @param {Record<string, unknown>} tasks Known task dictionary.
 * @param {string[]} taskIds Known task identities.
 * @returns {Record<string, unknown>} Normalised submission.
 */
function normaliseFullSubmission(
  rawSubmission: unknown,
  submissionIndex: number,
  root: FullAssignmentContext,
  tasks: Record<string, unknown>,
  taskIds: string[]
) {
  const submission = StudentSubmissionSchema.omit({ items: true }).parse(rawSubmission);
  if (!isIdentity(submission.studentId) || submission.assignmentId !== root.assignmentId)
    throw new TypeError('Invalid submission identity');
  if (!isRecord((rawSubmission as Record<string, unknown>).items))
    throw new TypeError('Invalid submission items');
  const rawItems = (rawSubmission as Record<string, unknown>).items as Record<string, unknown>;
  const outputItems: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(rawItems)) {
    if (!Object.hasOwn(tasks, key)) throw new Error(`Unknown task key ${key}`);
    outputItems[key] = normaliseFullItem(
      item,
      key,
      submission.documentId,
      submissionIndex,
      root,
      submission.studentId
    );
  }
  addMissingFullTasks(
    outputItems,
    taskIds,
    submissionIndex,
    root,
    submission.studentId,
    submission.documentId
  );
  return { ...submission, items: outputItems };
}

/** Validates or replaces a single identifiable full item.
 * @param {unknown} item Candidate item.
 * @param {string} key Trusted task identity.
 * @param {unknown} documentId Parent source identity.
 * @param {number} index Submission index.
 * @param {FullAssignmentContext} root Assignment context.
 * @param {string} studentId Trusted student identity.
 * @returns {unknown} Valid item or corruption replacement.
 */
function normaliseFullItem(
  item: unknown,
  key: string,
  documentId: unknown,
  index: number,
  root: FullAssignmentContext,
  studentId: string
): unknown {
  if (isValidFullItem(item, key, documentId)) return item;
  diagnostic(
    { classId: root.courseId, assignmentId: root.assignmentId, studentId, taskId: key },
    itemErrorPath(item, `submissions.${index}.items.${key}`, false)
  );
  return corruptItem(key, item, false, corruptMap);
}

/** Adds coverage errors for missing known tasks when full current coverage applies.
 * @param {Record<string, unknown>} output Normalised item dictionary.
 * @param {string[]} taskIds Known task identities.
 * @param {number} index Submission index.
 * @param {FullAssignmentContext} root Assignment context.
 * @param {string} studentId Trusted student identity.
 * @param {unknown} documentId Parent source identity.
 */
function addMissingFullTasks(
  output: Record<string, unknown>,
  taskIds: string[],
  index: number,
  root: FullAssignmentContext,
  studentId: string,
  documentId: unknown
): void {
  if (root.assessmentContractVersion !== 1 || documentId === null) return;
  for (const taskId of taskIds) {
    if (Object.hasOwn(output, taskId)) continue;
    diagnostic(
      { classId: root.courseId, assignmentId: root.assignmentId, studentId, taskId },
      `submissions.${index}.items.${taskId}`
    );
    output[taskId] = corruptItem(taskId, null, false, corruptMap);
  }
}

/**
 * Normalises an already-decoded full assignment read without mutating its input.
 * @param {unknown} input Decoded full assignment payload.
 * @returns {AssignmentFull | null} Normalised assignment or not-found.
 */
export function normaliseAssignmentRead(input: unknown) {
  if (input === null) return null;
  const rawSubmissions = (input as { submissions: unknown }).submissions;
  if (!Array.isArray(rawSubmissions)) throw new TypeError('Invalid assignment submissions root');
  const rootInput = withoutField(input as Record<string, unknown>, 'submissions');
  const root = fullRootSchema.parse(rootInput);
  if (!hasConsistentFullRoot(root))
    throw new TypeError('Invalid assignment identity or task definition');
  const tasks = root.assignmentDefinition.tasks;
  const taskIds = Object.keys(tasks);
  const submissions = rawSubmissions.map((raw, index) =>
    normaliseFullSubmission(raw, index, root, tasks, taskIds)
  );
  const normalised: unknown = { ...root, submissions };
  return AssignmentFullSchema.parse(normalised as unknown as AssignmentFull);
}

/**
 * Normalises class-embedded partial assignments, validating supplied entries only.
 * @param {unknown} input Decoded class payload.
 * @returns {ClassFull | null} Normalised class or not-found.
 */
export function normaliseClassRead(input: unknown) {
  if (input === null) return null;
  const root = classRootSchema.parse(input);
  if (!isIdentity(root.classId)) throw new TypeError('Invalid class identity');
  const raw = input as { assignments: unknown };
  if (!Array.isArray(raw.assignments)) throw new TypeError('Invalid class assignments root');
  const assignments = raw.assignments.map((candidate) => {
    const assignmentRoot = fullAssignmentRootSchema.parse(candidate);
    if (
      !isIdentity(assignmentRoot.assignmentId) ||
      !isIdentity(assignmentRoot.assignmentDefinitionKey)
    ) {
      throw new TypeError('Invalid partial assignment identity');
    }
    const rawAssignment = candidate as Record<string, unknown>;
    if (!Array.isArray(rawAssignment.submissions))
      throw new TypeError('Invalid partial submissions');
    const submissions = rawAssignment.submissions.map((entry, index) =>
      normalisePartialSubmission(entry, index, assignmentRoot.assignmentId, root.classId)
    );
    return AssignmentPartialSchema.parse({ ...assignmentRoot, submissions });
  });
  return ClassFullSchema.parse({ ...root, assignments });
}

/** Normalises one provided partial submission without inferring missing entries.
 * @param {unknown} entry Candidate submission.
 * @param {number} submissionIndex Position for safe diagnostic paths.
 * @param {string} assignmentId Owning assignment identity.
 * @param {string} classId Owning class identity.
 * @returns {Record<string, unknown>} Normalised submission.
 */
function normalisePartialSubmission(
  entry: unknown,
  submissionIndex: number,
  assignmentId: string,
  classId: string
): Record<string, unknown> {
  const submission = StudentSubmissionPartialSchema.omit({ items: true }).parse(entry);
  if (!isIdentity(submission.studentId) || submission.assignmentId !== assignmentId)
    throw new TypeError('Invalid partial submission identity');
  const items = (entry as Record<string, unknown>).items;
  if (!isRecord(items)) throw new TypeError('Invalid partial items');
  if (Object.keys(items).some((key) => !isIdentity(key)))
    throw new TypeError('Invalid partial task identity');
  const normalised: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(items)) {
    if (isValidPartialItem(item, key, submission.documentId)) {
      normalised[key] = item;
      continue;
    }
    diagnostic(
      { classId, assignmentId, studentId: submission.studentId, taskId: key },
      itemErrorPath(item, `assignments.submissions.${submissionIndex}.items.${key}`, true)
    );
    normalised[key] = corruptItem(key, item, true, corruptMap);
  }
  return { ...submission, items: normalised };
}
