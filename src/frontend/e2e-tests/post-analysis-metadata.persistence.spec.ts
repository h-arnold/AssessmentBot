import { expect, test } from '@playwright/test';
import {
  createChangedMetadataScenario,
  createLaterVersionMetadataScenario,
  POST_ANALYSIS_ASSIGNMENT_TITLE,
  POST_ANALYSIS_CLASS_NAME,
  POST_ANALYSIS_CLASS_ID,
} from './helpers/post-analysis-metadata-scenarios';
import {
  getMethodCalls,
  installRuntimeMock,
  selectVisibleOption,
} from './shared/endToEndRuntimeMocks';

const MAX_EXPECTED_CLASS_READS = 3;
const STRICT_MODE_READ_COUNT = 2;
const MAX_EXPECTED_WRITES = 1;
const EXPECTED_CLASS_READ_COUNT = 3;
const EXPECTED_REFRESH_WRITE_COUNT = 2;
const EXPECTED_REFRESH_CLASS_READ_COUNT = 6;

test('persists changed post-analysis metadata for a class overview', async ({ page }) => {
  await installRuntimeMock(page, createChangedMetadataScenario('class'));
  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Classes' }).click();
  const card = page.getByRole('article').filter({ hasText: 'Synthetic Class 3' });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'View' }).click();
  await expect(page.getByRole('heading', { name: 'Synthetic Class 3' })).toBeVisible();
  await expect
    .poll(async () => {
      const methodCalls = await getMethodCalls(page);
      return methodCalls.filter((method) => method === 'updateABClass').length;
    })
    .toBe(MAX_EXPECTED_WRITES);
  await expect
    .poll(async () => {
      const methodCalls = await getMethodCalls(page);
      return methodCalls.filter((method) => method === 'getABClass').length;
    })
    .toBe(EXPECTED_CLASS_READ_COUNT);
  expect(POST_ANALYSIS_CLASS_ID).toBe('class-2');
  await expect(page.getByRole('status').filter({ hasText: /warning/i })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('persists changed post-analysis metadata for standalone Heatmaps without a write loop', async ({
  page,
}) => {
  await installRuntimeMock(page, createChangedMetadataScenario('heatmaps'));
  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Heatmaps', exact: true }).click();
  const classSelect = page.getByRole('combobox', { name: 'Class', exact: true });
  await classSelect.click();
  await selectVisibleOption(page, POST_ANALYSIS_CLASS_NAME);
  const assignments = page.getByRole('combobox', { name: 'Assignments', exact: true });
  await expect(assignments).toBeEnabled();
  await assignments.click();
  await selectVisibleOption(page, POST_ANALYSIS_ASSIGNMENT_TITLE);
  await expect(page.getByRole('table', { name: 'Task Heatmap' })).toBeVisible();

  const calls = await getMethodCalls(page);
  expect(calls.filter((method) => method === 'updateABClass')).toHaveLength(MAX_EXPECTED_WRITES);
  expect(calls.filter((method) => method === 'getABClass')).toHaveLength(MAX_EXPECTED_CLASS_READS);
  expect(calls.filter((method) => method === 'getABClassPartials')).toHaveLength(
    STRICT_MODE_READ_COUNT
  );
  expect(calls.indexOf('updateABClass')).toBeLessThan(calls.lastIndexOf('getABClass'));
  expect(calls).toContain('getAssignment');
  expect(POST_ANALYSIS_CLASS_ID).toBe('class-2');

  // Removing and restoring the selected assignment commits two visible dataset
  // changes, exercising post-commit effects against the same loaded source.
  await assignments.click();
  await selectVisibleOption(page, POST_ANALYSIS_ASSIGNMENT_TITLE);
  await expect(page.getByRole('table', { name: 'Task Heatmap' })).toHaveCount(0);
  await assignments.click();
  await selectVisibleOption(page, POST_ANALYSIS_ASSIGNMENT_TITLE);
  await expect(page.getByRole('table', { name: 'Task Heatmap' })).toBeVisible();
  const updateCountAssertion = expect
    .poll(async () => {
      const latestCalls = await getMethodCalls(page);
      return latestCalls.filter((method) => method === 'updateABClass').length;
    })
    .toBe(MAX_EXPECTED_WRITES);
  await updateCountAssertion;
  await expect(page.getByRole('status').filter({ hasText: /warning/i })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('writes a refreshed newer assignment version exactly once', async ({ page }) => {
  await installRuntimeMock(page, createLaterVersionMetadataScenario());
  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Heatmaps', exact: true }).click();
  const classSelect = page.getByRole('combobox', { name: 'Class', exact: true });
  await classSelect.click();
  await selectVisibleOption(page, POST_ANALYSIS_CLASS_NAME);
  const assignments = page.getByRole('combobox', { name: 'Assignments', exact: true });
  await expect(assignments).toBeEnabled();
  await assignments.click();
  await selectVisibleOption(page, POST_ANALYSIS_ASSIGNMENT_TITLE);
  await expect(page.getByRole('table', { name: 'Task Heatmap' })).toBeVisible();
  await expect
    .poll(async () => {
      const methodCalls = await getMethodCalls(page);
      return methodCalls.filter((method) => method === 'updateABClass').length;
    })
    .toBe(1);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect
    .poll(async () => {
      const methodCalls = await getMethodCalls(page);
      return methodCalls.filter((method) => method === 'updateABClass').length;
    })
    .toBe(EXPECTED_REFRESH_WRITE_COUNT);
  await expect
    .poll(async () => {
      const methodCalls = await getMethodCalls(page);
      return methodCalls.filter((method) => method === 'getABClass').length;
    })
    .toBe(EXPECTED_REFRESH_CLASS_READ_COUNT);
  const methodCalls = await getMethodCalls(page);
  expect(methodCalls.filter((method) => method === 'updateABClass')).toHaveLength(
    EXPECTED_REFRESH_WRITE_COUNT
  );
  await expect(page.getByRole('status').filter({ hasText: /warning/i })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
