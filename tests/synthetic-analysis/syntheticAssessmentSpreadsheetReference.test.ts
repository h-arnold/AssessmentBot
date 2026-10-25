import { describe, expect, it } from 'vitest';

import { generateSyntheticAnalysisGraph } from '#synthetic-data/generateSyntheticAnalysisGraph.js';

import { artefactsOfTask, recordsOf, requireRecord } from './syntheticAssessmentContractSupport.js';

/**
 * Generated SPREADSHEET reference usability regression suite: the canonical
 * definition contract requires a completed SPREADSHEET reference to carry an
 * assessable formula, so the generator's reference grids must contain at least
 * one formula cell instead of prose, numbers, and nulls alone.
 */

/**
 * Collects the SPREADSHEET reference artefact grids from one generated graph.
 *
 * @param {Record<string, unknown>} graph Generated synthetic analysis graph.
 * @returns {number} Count of spreadsheets (kept for the emptiness guard).
 */
function collectSpreadsheetReferenceGrids(graph: Record<string, unknown>) {
  const persistence = requireRecord(graph.persistence, 'persistence');
  const grids = [];
  for (const definition of recordsOf(persistence.assignmentDefinitions, 'assignmentDefinitions')) {
    if (Array.isArray(definition.tasks)) continue;
    for (const [taskId, taskRaw] of Object.entries(
      requireRecord(definition.tasks, 'definition tasks')
    )) {
      const task = requireRecord(taskRaw, `task ${taskId}`);
      for (const artefact of artefactsOfTask(task)) {
        if (artefact.type === 'SPREADSHEET') {
          grids.push({ taskId, grid: artefact.content });
        }
      }
    }
  }
  return grids;
}

/** Formula cell shape: a string body with an A1-style reference. */
const FORMULA_PATTERN = /[A-Z]+\d+/u;

describe('synthetic generated SPREADSHEET reference bodies', () => {
  it('generates SPREADSHEET reference grids with at least one assessable formula cell', () => {
    const graph = /** @type {Record<string, unknown>} */ generateSyntheticAnalysisGraph('small');
    const grids = collectSpreadsheetReferenceGrids(graph);
    expect(grids.length).toBeGreaterThan(0);
    for (const { taskId, grid } of grids) {
      const rows = grid as unknown[][];
      const flatCells = rows.flat();
      const formulaCells = flatCells.filter(
        (cell: unknown): cell is string => typeof cell === 'string' && cell.startsWith('=')
      );
      expect(
        formulaCells.some((formula: string) => FORMULA_PATTERN.test(formula)),
        `reference grid of task "${taskId}" must contain an assessable formula`
      ).toBe(true);
    }
  });
});
