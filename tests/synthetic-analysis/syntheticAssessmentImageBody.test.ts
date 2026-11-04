import { describe, expect, it } from 'vitest';

import { generateSyntheticAnalysisGraph } from '#synthetic-data/generateSyntheticAnalysisGraph.js';

import {
  readItemMap,
  recordsOf,
  requireArray,
  requireRecord,
} from './syntheticAssessmentContractSupport.js';
import { assertDecodablePngDataUrl } from './syntheticAssessmentImageBodySupport.js';

/**
 * Generated IMAGE body usability regression suite: every artefact the canonical
 * generator labels IMAGE must decode as a structurally valid PNG, not merely
 * carry the `data:image/` prefix around base64 prose.
 */

/** One IMAGE artefact body with a label describing where it came from. */
type ArtefactBodyRow = { label: string; content: unknown };

/**
 * Collects the IMAGE artefact bodies from one definition's task artefacts.
 *
 * @param definition Raw definition document.
 * @param definitionIndex Index of the definition in the persistence list.
 * @returns IMAGE artefact bodies in definition order.
 */
function collectDefinitionImageArtefacts(
  definition: Record<string, unknown>,
  definitionIndex: number
) {
  const artefacts: ArtefactBodyRow[] = [];
  if (Array.isArray(definition.tasks)) return artefacts;
  for (const [taskId, taskRaw] of Object.entries(
    requireRecord(definition.tasks, 'definition tasks')
  )) {
    const task = requireRecord(taskRaw, `task ${taskId}`);
    const artifacts = requireRecord(task.artifacts, 'task artifacts');
    for (const [role, roleArtefactList] of Object.entries(artifacts)) {
      for (const [index, roleArtefactRaw] of /** @type {unknown[]} */ requireArray(
        roleArtefactList,
        `${role} artefacts`
      ).entries()) {
        const artefact = requireRecord(roleArtefactRaw, 'artefact');
        if (artefact.type === 'IMAGE') {
          artefacts.push({
            label: `definition artefact (definition ${definitionIndex}, task ${taskId}, ${role}[${index}])`,
            content: artefact.content,
          });
        }
      }
    }
  }
  return artefacts;
}

/**
 * Collects the IMAGE artefact bodies from every persisted submission item.
 *
 * @param persistence Raw persistence view.
 * @returns IMAGE artefact bodies in submission order.
 */
function collectSubmissionImageArtefacts(persistence: Record<string, unknown>) {
  const artefacts: ArtefactBodyRow[] = [];
  for (const assignment of recordsOf(persistence.assignments, 'assignments')) {
    for (const submission of recordsOf(assignment.submissions, 'submissions')) {
      for (const [taskId, item] of Object.entries(readItemMap(submission.items))) {
        const artefact = requireRecord(item.artifact, 'artefact');
        if (artefact.type === 'IMAGE') {
          artefacts.push({ label: `submission item (task ${taskId})`, content: artefact.content });
        }
      }
    }
  }
  return artefacts;
}

/**
 * Collects every IMAGE artefact record from one generated graph.
 *
 * @param {Record<string, unknown>} graph Generated synthetic analysis graph.
 * @returns {ArtefactBodyRow[]} IMAGE artefact bodies in graph order.
 */
function collectGeneratedImageArtefacts(graph: Record<string, unknown>) {
  const persistence = requireRecord(graph.persistence, 'persistence');
  const artefacts: ArtefactBodyRow[] = [];
  for (const [definitionIndex, definition] of recordsOf(
    persistence.assignmentDefinitions,
    'assignmentDefinitions'
  ).entries()) {
    artefacts.push(...collectDefinitionImageArtefacts(definition, definitionIndex));
  }
  artefacts.push(...collectSubmissionImageArtefacts(persistence));
  return artefacts;
}

describe('synthetic generated IMAGE artefact bodies', () => {
  it('generates IMAGE artefacts whose bodies decode as structurally valid PNGs', () => {
    const graph = generateSyntheticAnalysisGraph('small') as Record<string, unknown>;
    const imageArtefacts = collectGeneratedImageArtefacts(graph);
    expect(imageArtefacts.length).toBeGreaterThan(0);
    for (const artefact of imageArtefacts) {
      expect(
        typeof artefact.content === 'string' && artefact.content.startsWith('data:image/'),
        `${artefact.label} must carry an image data URL`
      ).toBe(true);
      assertDecodablePngDataUrl(artefact.content as string, artefact.label);
    }
  });
});
