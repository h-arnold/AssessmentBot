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

/** @typedef {{label: string, content: unknown}} ArtefactBodyRow */

/**
 * Collects every IMAGE artefact record from one generated graph.
 *
 * @param {Record<string, unknown>} graph Generated synthetic analysis graph.
 * @returns {ArtefactBodyRow[]} IMAGE artefact bodies in graph order.
 */
function collectGeneratedImageArtefacts(graph: Record<string, unknown>) {
  const persistence = requireRecord(graph.persistence, 'persistence');
  /** @type {ArtefactBodyRow[]} */
  const artefacts = [];
  for (const [definitionIndex, definition] of recordsOf(
    persistence.assignmentDefinitions,
    'assignmentDefinitions'
  ).entries()) {
    if (Array.isArray(definition.tasks)) continue;
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
  }
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
