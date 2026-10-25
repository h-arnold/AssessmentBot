import { buildValidationContext } from '#synthetic-data/validationContext.js';
import { toTransportViews } from '#synthetic-data/toTransportViews.js';
import { validatePersistenceGraph } from '#synthetic-data/validatePersistenceGraph.js';
import { validateTransportGraph } from '#synthetic-data/validateTransportGraph.js';
import { assertAssignmentsByKeyView } from '#synthetic-data/validateAssignmentsByKeyView.js';
import { recordsOf, requireDefined, requireRecord } from './syntheticAssessmentContractSupport.js';
import {
  canonicalisePersistence,
  canonicaliseTransportViews,
  findCompletedDefinitionTask,
  findTarget,
  freshPieces,
} from './syntheticAssessmentValidationSupport.js';

/** @typedef {Record<string, unknown>} RawRecord */
/** @typedef {{item: RawRecord, submission: RawRecord, assignmentId: unknown}} Target */
/** @typedef {{taskId: string, task: RawRecord}} DefinitionTaskTarget */
/** @typedef {{validate: () => void, assignments?: () => RawRecord[], nullDocumentTarget: () => Target, healthyDocumentTarget: () => Target, definitionTask: () => DefinitionTaskTarget}} ValidatorOwner */

/** @returns {ValidatorOwner} Persistence-boundary owner. */
export function createPersistenceBoundary() {
  const pieces = freshPieces();
  canonicalisePersistence(pieces.persistence);
  const context = buildValidationContext(pieces.manifest, pieces.referenceData, pieces.persistence);
  return {
    validate: () =>
      validatePersistenceGraph({
        manifest: pieces.manifest,
        referenceData: pieces.referenceData,
        persistence: pieces.persistence,
        context,
      }),
    assignments: () => pieces.persistence.assignments,
    nullDocumentTarget: () => findTarget(pieces.persistence.assignments, true),
    healthyDocumentTarget: () => findTarget(pieces.persistence.assignments, false),
    definitionTask: () =>
      findCompletedDefinitionTask(
        pieces.persistence.assignments,
        pieces.persistence.assignmentDefinitions,
        (assignment) => String(assignment.assignmentDefinitionKey)
      ),
  };
}

/**
 * Full-transport owner, driven directly through `assertAssignmentsByKeyView`
 * with an independent projection clone so the class-partial-first traversal
 * cannot mask a full-boundary failure and no mutated view aliases the
 * persistence nodes the context derives from.
 *
 * @returns {ValidatorOwner} Full-transport boundary owner.
 */
export function createFullTransportBoundary() {
  const pieces = freshPieces();
  canonicalisePersistence(pieces.persistence);
  const context = buildValidationContext(pieces.manifest, pieces.referenceData, pieces.persistence);
  const projectionPieces = freshPieces();
  canonicalisePersistence(projectionPieces.persistence);
  const views = /** @type {{assignmentsByKey: unknown, classesById: unknown}} */ (
    toTransportViews({
      referenceData: projectionPieces.referenceData,
      classes: projectionPieces.persistence.classes,
      assignmentDefinitions: projectionPieces.persistence.assignmentDefinitions,
      assignments: projectionPieces.persistence.assignments,
    })
  );
  canonicaliseTransportViews(views);
  const assignmentsByKey = /** @type {RawRecord[]} */ (Object.values(views.assignmentsByKey));
  return {
    validate: () =>
      assertAssignmentsByKeyView({
        assignmentsByKey: views.assignmentsByKey,
        assignments: pieces.persistence.assignments,
        definitionByKey: context.definitionByKey,
        rosterByClassId: context.rosterByClassId,
        definitionTaskIdsByKey: context.definitionTaskIdsByKey,
      }),
    assignments: () => assignmentsByKey,
    nullDocumentTarget: () => findTarget(assignmentsByKey, true),
    healthyDocumentTarget: () => findTarget(assignmentsByKey, false),
    definitionTask: () =>
      findCompletedDefinitionTask(
        Object.values(views.assignmentsByKey),
        projectionPieces.persistence.assignmentDefinitions,
        (partial) => String(requireRecord(partial.assignmentDefinition, 'definition').definitionKey)
      ),
  };
}

/**
 * Class-partials transport owner. The aggregate transport validator visits
 * class partials first, so its setup keeps the full view and persistence
 * coherent and the baseline asserts the retained partial E reasoning.
 *
 * @param {'keyed'|'partialOnly'} variant Owning-definition shape to probe.
 * @returns {ValidatorOwner} Class-partial boundary owner.
 */
export function createClassTransportBoundary(variant) {
  const pieces = freshPieces();
  canonicalisePersistence(pieces.persistence);
  const views = /** @type {{assignmentsByKey: unknown, classesById: unknown}} */ (
    toTransportViews({
      referenceData: pieces.referenceData,
      classes: pieces.persistence.classes,
      assignmentDefinitions: pieces.persistence.assignmentDefinitions,
      assignments: pieces.persistence.assignments,
    })
  );
  canonicaliseTransportViews(views);
  const context = buildValidationContext(pieces.manifest, pieces.referenceData, pieces.persistence);
  const definitionByKey = new Map(
    recordsOf(pieces.persistence.assignmentDefinitions, 'assignmentDefinitions').map(
      (definition) => [definition.definitionKey, definition]
    )
  );
  const variantAssignments = () =>
    Object.values(views.classesById).flatMap((classView) =>
      recordsOf(classView.assignments, 'assignments').filter((assignment) => {
        const definition = definitionByKey.get(String(assignment.assignmentDefinitionKey));
        if (definition === undefined) {
          throw new Error(
            `Embedded partial definition "${String(assignment.assignmentDefinitionKey)}" must resolve.`
          );
        }
        return Array.isArray(definition.tasks) === (variant === 'partialOnly');
      })
    );
  return {
    validate: () =>
      validateTransportGraph({
        transport: views,
        assignments: pieces.persistence.assignments,
        context,
      }),
    assignments: variantAssignments,
    nullDocumentTarget: () => findTarget(variantAssignments(), true),
    healthyDocumentTarget: () => findTarget(variantAssignments(), false),
    definitionTask:
      variant === 'keyed'
        ? () =>
            findCompletedDefinitionTask(
              variantAssignments(),
              pieces.persistence.assignmentDefinitions,
              (assignment) => String(assignment.assignmentDefinitionKey)
            )
        : () => {
            throw new Error('Class-embedded partial definitions carry no shared artefacts.');
          },
  };
}
