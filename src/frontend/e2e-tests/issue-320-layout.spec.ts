import { expect, test } from '@playwright/test';
import {
  createAssignmentsScenario,
  createAuthenticationSettingsScenario,
  getMethodCalls,
  installRuntimeMock,
  selectVisibleOption,
} from './shared/endToEndRuntimeMocks';
import { createHeatmapScenario } from './helpers/task-heatmap-end-to-end-helpers';
import editableDefinitions from '@synthetic/small/editableDefinitions.json';
import {
  baseCohorts,
  baseYearGroups,
  createSuccessfulClassesScenario,
  matchedClassPartials,
  matchedGoogleClassrooms,
  openClassesTabWithScenario,
} from './classes-crud.shared';

const minimumButtonClearance = 8;
const roundingTolerance = 0.25;
const assignmentsViewportWidth = 1440;
const narrowViewportWidth = 390;
const narrowViewportHeight = 844;
const wideViewportHeight = 1000;
const wideViewport1920 = 1920;
const wideViewport2560 = 2560;
const assignmentsForReset = Object.values(editableDefinitions);
const filteredAssignmentsRowCount = 2;
const allAssignmentsRowCount = 4;
const allClassesRowCount = 2;
const expectedAuthFormGap = 24;
const wideViewportWidths = [wideViewport1920, wideViewport2560];
const expectedShellPadding = 16;

test.describe('responsive page layout contracts', () => {
  test('keeps Assignments reset control clear of header edges and resets filters', async ({
    page,
  }) => {
    await installRuntimeMock(
      page,
      createAssignmentsScenario({ initialPartials: assignmentsForReset })
    );
    await page.setViewportSize({ width: assignmentsViewportWidth, height: wideViewportHeight });
    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Assignments' }).click();

    const assignmentsCard = page
      .locator('.ant-card')
      .filter({ hasText: 'Assignment definitions' })
      .first();
    const assignmentsHeader = assignmentsCard.locator('.ant-card-head');
    const assignmentsButton = assignmentsHeader.getByRole('button', {
      name: 'Reset sort and filters',
    });
    await expect(assignmentsButton).toBeVisible();
    const assignmentsClearance = await assignmentsHeader.evaluate((header) => {
      const button = header.querySelector('button');
      if (!(button instanceof HTMLElement)) throw new TypeError('Reset button missing from header');
      const headerBox = header.getBoundingClientRect();
      const buttonBox = button.getBoundingClientRect();
      return { top: buttonBox.top - headerBox.top, bottom: headerBox.bottom - buttonBox.bottom };
    });
    expect(assignmentsClearance.top).toBeGreaterThanOrEqual(
      minimumButtonClearance - roundingTolerance
    );
    expect(assignmentsClearance.bottom).toBeGreaterThanOrEqual(
      minimumButtonClearance - roundingTolerance
    );

    const assignmentsTable = page.getByRole('table', { name: 'Assignment definitions table' });
    await assignmentsTable
      .getByRole('columnheader', { name: 'Topic' })
      .locator('.ant-table-filter-trigger')
      .click();
    await page
      .locator('.ant-dropdown:visible')
      .getByRole('button', { name: 'Synthetic Topic 1', exact: true })
      .click();
    await expect(assignmentsTable.getByRole('row')).toHaveCount(filteredAssignmentsRowCount);
    await assignmentsButton.click();
    await expect(assignmentsTable.getByRole('row')).toHaveCount(allAssignmentsRowCount);
  });

  test('keeps Classes reset control clear of header edges and resets filters', async ({ page }) => {
    await openClassesTabWithScenario(
      page,
      createSuccessfulClassesScenario({
        classPartials: matchedClassPartials,
        cohorts: baseCohorts,
        yearGroups: baseYearGroups,
        googleClassrooms: matchedGoogleClassrooms,
      })
    );
    await page.setViewportSize({ width: assignmentsViewportWidth, height: wideViewportHeight });
    const classesButton = page.getByRole('button', { name: 'Reset sort and filters' });
    const classesHeader = classesButton.locator(
      'xpath=ancestor::div[contains(@class,"app-card-header--controls")]'
    );
    await expect(classesButton).toBeVisible();
    const classesClearance = await classesHeader.evaluate((header) => {
      const button = header.querySelector('button');
      if (!(button instanceof HTMLElement)) throw new TypeError('Reset button missing from header');
      const headerBox = header.getBoundingClientRect();
      const buttonBox = button.getBoundingClientRect();
      return { top: buttonBox.top - headerBox.top, bottom: headerBox.bottom - buttonBox.bottom };
    });
    expect(classesClearance.top).toBeGreaterThanOrEqual(minimumButtonClearance - roundingTolerance);
    expect(classesClearance.bottom).toBeGreaterThanOrEqual(
      minimumButtonClearance - roundingTolerance
    );

    const classesTable = page.getByRole('table', { name: 'Classes table' });
    await classesTable
      .getByRole('columnheader', { name: 'Status' })
      .locator('.ant-table-filter-trigger')
      .click();
    await page
      .locator('.ant-dropdown:visible')
      .getByRole('menuitem', { name: 'active', exact: true })
      .click();
    await page.keyboard.press('Escape');
    await expect(classesTable.locator('tbody tr[data-row-key]')).toHaveCount(1);
    await classesButton.click();
    await expect(classesTable.locator('tbody tr[data-row-key]')).toHaveCount(allClassesRowCount);
  });

  test('keeps the authentication provider-to-save gap at 24px in both modes and saves', async ({
    page,
  }) => {
    const initialSettings = {
      authMode: 'googleGroups' as const,
      authGroupEmail: 'admins@example.com',
      authUsers: [{ email: 'admin@example.com', role: 'admin' as const }],
      authRevision: '1',
    };
    await installRuntimeMock(
      page,
      createAuthenticationSettingsScenario({
        saveResponses: [
          { kind: 'success', data: { success: true, authRevision: '2' } },
          { kind: 'success', data: { success: true, authRevision: '3' } },
        ],
        authenticationSettings: [
          { kind: 'success', data: initialSettings },
          { kind: 'success', data: initialSettings },
          { kind: 'success', data: initialSettings },
          { kind: 'success', data: initialSettings },
        ],
      })
    );
    await page.goto('/');
    await page.getByRole('menuitem', { name: 'Settings' }).click();
    await page.getByRole('tab', { name: 'Authentication' }).click();
    const panel = page.getByRole('region', { name: 'Authentication settings panel' });
    const providerCard = panel
      .locator('.ant-card')
      .filter({ hasText: 'Authentication provider' })
      .first();
    const saveButton = panel.locator('form').getByRole('button', { name: 'Save' });
    const assertGap = async () => {
      const gap = await providerCard.evaluate((card) => {
        const panel = card.closest('[aria-label="Authentication settings panel"]');
        const saveButton = panel?.querySelector('button[type="submit"]');
        const save = saveButton?.closest('.ant-form-item');
        if (!(save instanceof HTMLElement))
          throw new TypeError('Save row is not a sibling of the provider card');
        const cardBox = card.getBoundingClientRect();
        const saveBox = save.getBoundingClientRect();
        return saveBox.top - cardBox.bottom;
      });
      expect(gap).toBe(expectedAuthFormGap);
    };
    await expect(panel.getByLabel('Auth group email')).toBeVisible();
    await assertGap();
    await panel.getByRole('combobox', { name: 'Authentication mode' }).click();
    await selectVisibleOption(page, 'Script Properties');
    await page.getByRole('button', { name: 'Confirm switch' }).click();
    await expect(panel.getByRole('columnheader', { name: /email/i })).toBeVisible();
    await assertGap();
    await saveButton.click();
    await expect(saveButton).toBeEnabled();
    expect(await getMethodCalls(page)).toContain('setAuthenticationSettings');
  });

  test('fills the shell at wide viewports, resizes fluidly, and remains within shell padding when narrow', async ({
    page,
  }) => {
    await installRuntimeMock(page, createHeatmapScenario());
    for (const width of wideViewportWidths) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/');
      await page.getByRole('menuitem', { name: 'Heatmaps' }).click();
      const content = page.locator('.app-content');
      const frame = page.locator('.app-page-content--fluid');
      const geometry = await content.evaluate((shellContent) => {
        const pageContent = shellContent.querySelector('.app-page-content--fluid');
        if (!(pageContent instanceof HTMLElement))
          throw new TypeError('Fluid Heatmaps frame missing');
        const shell = shellContent.getBoundingClientRect();
        const inner = pageContent.getBoundingClientRect();
        const style = getComputedStyle(shellContent);
        return {
          frameWidth: inner.width,
          availableWidth:
            shell.width -
            Number.parseFloat(style.paddingLeft) -
            Number.parseFloat(style.paddingRight),
          leftPadding: inner.left - shell.left,
          rightPadding: shell.right - inner.right,
        };
      });
      await expect(frame).toBeVisible();
      expect(Math.abs(geometry.frameWidth - geometry.availableWidth)).toBeLessThanOrEqual(1);
      expect(geometry.leftPadding).toBe(expectedShellPadding);
      expect(geometry.rightPadding).toBe(expectedShellPadding);
    }
    await page.setViewportSize({ width: narrowViewportWidth, height: narrowViewportHeight });
    await expect(page.locator('.app-page-content--fluid')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
