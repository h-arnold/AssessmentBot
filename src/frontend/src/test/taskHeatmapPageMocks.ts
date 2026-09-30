/**
 * Shared mock setup for `TaskHeatmapPage` specs that stub the assignment
 * assessment service, the frontend logger and the heatmap table.
 *
 * Registering the `vi.mock` factories here keeps the module-level mock block
 * identical across the heatmap page specs while the specs receive fresh mock
 * instances per test file, preserving each spec's own seeding in `beforeEach`.
 *
 * Import this module before any production import so the mock factories are
 * registered before the (real) service modules are first instantiated.
 */

import { createElement } from 'react';
import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetAssignment: vi.fn(),
  mockLogFrontendError: vi.fn(),
  mockLogFrontendEvent: vi.fn(),
  mockTaskHeatmapTable: vi.fn(() => createElement('div', { 'data-testid': 'task-heatmap-table' })),
}));

vi.mock('../services/assignmentAssessment/assignmentAssessmentService', () => ({
  getAssignment: mocks.mockGetAssignment,
}));

vi.mock('../logging/frontendLogger', () => ({
  logFrontendError: mocks.mockLogFrontendError,
  logFrontendEvent: mocks.mockLogFrontendEvent,
}));

vi.mock('../features/taskHeatmap/TaskHeatmapTable', () => ({
  TaskHeatmapTable: mocks.mockTaskHeatmapTable,
}));

/** Mock for `getAssignment` on the assignment assessment service. */
export const mockGetAssignment = mocks.mockGetAssignment;

/** Mock for `logFrontendError` on the frontend logger. */
export const mockLogFrontendError = mocks.mockLogFrontendError;

/** Mock for `logFrontendEvent` on the frontend logger. */
export const mockLogFrontendEvent = mocks.mockLogFrontendEvent;

/** Mock for the `TaskHeatmapTable` component, rendering a detectable placeholder. */
export const mockTaskHeatmapTable = mocks.mockTaskHeatmapTable;
