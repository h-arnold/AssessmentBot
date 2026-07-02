import { describe, expect, it } from 'vitest';
import { pageContent } from '../../pages/pageContent';

describe('pageContent.classDetail', () => {
  it('exports heading as "Class Overview"', () => {
    expect(pageContent.classDetail.heading).toBe('Class Overview');
  });

  it('exports summary as "Review assessment performance for this class."', () => {
    expect(pageContent.classDetail.summary).toBe('Review assessment performance for this class.');
  });

  it('exports recentAssignmentsEmpty as "No recent assessments yet"', () => {
    expect(pageContent.classDetail.recentAssignmentsEmpty).toBe('No recent assessments yet');
  });

  it('exports searchEmpty as "No students match your search"', () => {
    expect(pageContent.classDetail.searchEmpty).toBe('No students match your search');
  });
});
