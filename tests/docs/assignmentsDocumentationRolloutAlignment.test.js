import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { pageContent } from '../../src/frontend/src/pages/pageContent';

const repositoryRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const specPath = path.join(repositoryRoot, 'SPEC.md');
const assignmentsLayoutPath = path.join(repositoryRoot, 'ASSIGNMENTS_PAGE_LAYOUT.md');
const actionPlanPath = path.join(repositoryRoot, 'ACTION_PLAN.md');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function getMarkdownSection(documentContent, heading, level = 2) {
  const escapedHeading = heading.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const headingPrefix = '#'.repeat(level);
  const sectionRegex = new RegExp(
    String.raw`${headingPrefix} ${escapedHeading}\n([\s\S]*?)(?:\n${headingPrefix} |$)`
  );
  const sectionMatch = documentContent.match(sectionRegex);

  if (!sectionMatch) {
    throw new Error(`Could not find markdown section: ${heading}`);
  }

  return sectionMatch[1];
}

function getRecommendedSummaryFromLayout(assignmentsLayout) {
  const summaryMatch = assignmentsLayout.match(/Recommended summary copy:\s*\n\s*`([^`]+)`/);

  if (!summaryMatch) {
    throw new Error(
      'Could not find recommended assignments summary copy in ASSIGNMENTS_PAGE_LAYOUT.md'
    );
  }

  return summaryMatch[1].trim();
}

describe('Assignments documentation rollout alignment', () => {
  it('keeps assignments summary copy aligned with layout guidance and definition-management intent', () => {
    const assignmentsLayout = readFile(assignmentsLayoutPath);
    const recommendedSummary = getRecommendedSummaryFromLayout(assignmentsLayout);

    expect(pageContent.assignments.summary).toBe(recommendedSummary);
    expect(pageContent.assignments.summary).toMatch(/definition/i);
    expect(pageContent.assignments.summary).toMatch(/review|remove/i);
    expect(pageContent.assignments.summary).not.toMatch(/marking/i);
  });

  it('documents status/actions and table visible-state contracts in the layout specification', () => {
    const assignmentsLayout = readFile(assignmentsLayoutPath);
    const statusActionsRegion = getMarkdownSection(
      assignmentsLayout,
      '1. Status and actions region'
    );
    const assignmentTableRegion = getMarkdownSection(
      assignmentsLayout,
      '2. Assignment definitions table region'
    );

    const expectedStatusActionStates = [
      '1. **Initial loading**',
      '2. **Ready**',
      '3. **Delete success**',
      '4. **Delete failure**',
      '5. **Blocking failure**',
    ];

    const expectedTableStates = [
      '1. **Initial loading**',
      '2. **Ready with data**',
      '3. **Ready with no data**',
      '4. **Refresh in progress**',
      '5. **Blocking failure**',
    ];

    expectedStatusActionStates.forEach((expectedState) => {
      expect(statusActionsRegion).toContain(expectedState);
    });

    expectedTableStates.forEach((expectedState) => {
      expect(assignmentTableRegion).toContain(expectedState);
    });
  });

  it('keeps deleteAssignmentDefinition contract notes in SPEC aligned with trimmed-key validation expectations', () => {
    const specDocument = readFile(specPath);
    const deleteContractSection = getMarkdownSection(
      specDocument,
      '`deleteAssignmentDefinition`',
      3
    );

    expect(deleteContractSection).toContain('- Accepts `{ definitionKey: string }`.');
    expect(deleteContractSection).toMatch(/Rejects the request if the key is not already trimmed/i);
    expect(deleteContractSection).toMatch(/definitionKey\s*!==\s*definitionKey\.trim\(\)/);
  });

  it('requires documentation rollout implementation notes to be filled before closure', () => {
    const actionPlan = readFile(actionPlanPath);
    const documentationSection = getMarkdownSection(actionPlan, 'Documentation and rollout notes');

    expect(documentationSection).not.toContain('- Populate during execution.');
    expect(documentationSection).toContain('- [x] checks passed');
    expect(documentationSection).toContain('- [x] action plan updated');
  });
});
