/**
 * Test-only instrumentation for the single-pass read contract.
 *
 * The normalisers validate submission items through one of two item schemas
 * (`StudentSubmissionItemSchema` on the full read, `StudentSubmissionItemPartialSchema`
 * on the class read). A parent schema's parse does not call the sub-schema's public
 * `parse`/`safeParse` methods, so spying there undercounts. Instead, each item schema
 * is rebuilt as a `z.preprocess` wrapper that records the attempt and delegates to the
 * real schema, and the parent schemas are re-derived so they reference that wrapper.
 *
 * `z.preprocess` runs even when the core item parse later fails, which is what makes the
 * schema-corrupt outcome observable; a `.refine` would not run after a failed core parse.
 * The follow-on `.transform` only runs when the core parse and all of its refinements
 * succeed, so successes are recorded exactly for successful evaluations and failures are
 * the difference between attempts and successes.
 *
 * This module is test support: production code never imports it.
 *
 * @see docs/developer/frontend/frontend-testing.md
 * @see docs/plans/SPEC.md (decision 3)
 */

import { z } from 'zod';
import type * as AssignmentSchemas from '@/services/assignmentAssessment/assignmentAssessment.zod';
import type * as ClassDetailSchemas from '@/services/googleClassrooms/classDetail/classDetailService.zod';

/** Which read path evaluated an item. */
export type ItemReadKind = 'full' | 'partial';

/** Evaluation tally for one item identity within one read kind. */
export type ItemEvaluationTally = {
  attempts: number;
  successes: number;
};

const tallies: Record<ItemReadKind, Record<string, ItemEvaluationTally>> = {
  full: {},
  partial: {},
};

/**
 * Returns the mutable tally for one item identity.
 * @param {ItemReadKind} kind Read path that evaluated the item.
 * @param {string} key Item identity.
 * @returns {ItemEvaluationTally} The tally to update.
 */
function tallyFor(kind: ItemReadKind, key: string): ItemEvaluationTally {
  const kindTallies = tallies[kind];
  if (Object.hasOwn(kindTallies, key)) return kindTallies[key];
  const created: ItemEvaluationTally = { attempts: 0, successes: 0 };
  kindTallies[key] = created;
  return created;
}

/**
 * Derives a stable identity from an evaluation input.
 *
 * Canonical item identifiers embed the owning assignment and student, so
 * `taskId::id` is unique per stored item while staying readable in a diff.
 * @param {unknown} value Candidate item passed to the item schema.
 * @returns {string} The item identity, or a placeholder for unreadable input.
 */
export function itemSchemaKey(value: unknown): string {
  if (typeof value !== 'object' || value === null) return '<unidentifiable>';
  const { id, taskId } = value as { id?: unknown; taskId?: unknown };
  const readableTaskId = typeof taskId === 'string' ? taskId : '<no-taskId>';
  const readableId = typeof id === 'string' ? id : '<no-id>';
  return `${readableTaskId}::${readableId}`;
}

/**
 * Wraps an item schema with attempt and success recording.
 *
 * The wrapper preserves the item schema's input and output contract, so parent
 * schemas can be re-derived with it in place of the original instance.
 * @template {z.ZodType} TItem Item schema type.
 * @param {TItem} schema The real item schema to delegate to.
 * @param {ItemReadKind} kind Read path that owns this schema instance.
 * @returns {TItem} The instrumented schema, typed as the original.
 */
export function instrumentItemSchema<TItem extends z.ZodType>(
  schema: TItem,
  kind: ItemReadKind
): TItem {
  const instrumented = z.preprocess(
    (value: unknown) => {
      tallyFor(kind, itemSchemaKey(value)).attempts += 1;
      return value;
    },
    schema.transform((value) => {
      tallyFor(kind, itemSchemaKey(value)).successes += 1;
      return value;
    })
  );
  // The pipe keeps the item schema's input and output contract; the cast lets
  // the parent schema definitions accept the instrumented instance unchanged.
  return instrumented as unknown as TItem;
}

/**
 * Clears every recorded evaluation between tests.
 */
export function resetItemSchemaEvaluations(): void {
  tallies.full = {};
  tallies.partial = {};
}

/**
 * Returns every item tally for one read path, ordered by item identity.
 * @param {ItemReadKind} kind Read path to report.
 * @returns {Record<string, ItemEvaluationTally>} Detached tallies keyed by item identity.
 */
export function itemSchemaTally(kind: ItemReadKind): Record<string, ItemEvaluationTally> {
  const kindTallies = tallies[kind];
  const result: Record<string, ItemEvaluationTally> = {};
  const keys = Object.keys(kindTallies).toSorted((left, right) => left.localeCompare(right));
  for (const key of keys) {
    result[key] = { ...kindTallies[key] };
  }
  return result;
}

/**
 * Returns one item's tally for one read path.
 * @param {ItemReadKind} kind Read path that evaluated the item.
 * @param {string} key Item identity.
 * @returns {ItemEvaluationTally} The detached tally, zeroed when never evaluated.
 */
export function itemSchemaEvaluationCount(kind: ItemReadKind, key: string): ItemEvaluationTally {
  const kindTallies = tallies[kind];
  return Object.hasOwn(kindTallies, key) ? { ...kindTallies[key] } : { attempts: 0, successes: 0 };
}

/**
 * Re-derives the full-read schemas around the instrumented full item schema.
 *
 * Rebuilding is required because the parent schemas capture their nested item
 * schema instance at construction time.
 * @param {Pick<typeof AssignmentSchemas, 'StudentSubmissionItemSchema' | 'StudentSubmissionSchema' | 'AssignmentFullSchema'>} actual
 *   The real assignment-assessment schema module.
 * @returns {object} The instrumented item schema plus re-derived parent schemas.
 */
export function rebuildFullReadSchemas(
  actual: Pick<
    typeof AssignmentSchemas,
    'StudentSubmissionItemSchema' | 'StudentSubmissionSchema' | 'AssignmentFullSchema'
  >
) {
  const item = instrumentItemSchema(actual.StudentSubmissionItemSchema, 'full');
  const submission = actual.StudentSubmissionSchema.extend({
    items: z.record(z.string(), item),
  });
  const assignment = actual.AssignmentFullSchema.extend({
    submissions: z.array(submission),
  });
  return {
    StudentSubmissionItemSchema: item,
    StudentSubmissionSchema: submission,
    AssignmentFullSchema: assignment,
    AssignmentFullResponseSchema: assignment.nullable(),
  };
}

/**
 * Re-derives the class-read schemas around the instrumented partial item schema.
 * @param {Pick<typeof ClassDetailSchemas, 'StudentSubmissionItemPartialSchema' | 'StudentSubmissionPartialSchema' | 'AssignmentPartialSchema' | 'ClassFullSchema'>} actual
 *   The real class-detail schema module.
 * @returns {object} The instrumented item schema plus re-derived parent schemas.
 */
export function rebuildPartialReadSchemas(
  actual: Pick<
    typeof ClassDetailSchemas,
    | 'StudentSubmissionItemPartialSchema'
    | 'StudentSubmissionPartialSchema'
    | 'AssignmentPartialSchema'
    | 'ClassFullSchema'
  >
) {
  const item = instrumentItemSchema(actual.StudentSubmissionItemPartialSchema, 'partial');
  const submission = actual.StudentSubmissionPartialSchema.extend({
    items: z.record(z.string(), item),
  });
  const assignment = actual.AssignmentPartialSchema.extend({
    submissions: z.array(submission),
  });
  const classFull = actual.ClassFullSchema.extend({
    assignments: z.array(assignment),
  });
  return {
    StudentSubmissionItemPartialSchema: item,
    StudentSubmissionPartialSchema: submission,
    AssignmentPartialSchema: assignment,
    ClassFullSchema: classFull,
    ClassFullResponseSchema: classFull.nullable(),
  };
}
