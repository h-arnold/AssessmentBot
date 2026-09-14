const FIRST_YEAR_GROUP = 7;
const YEAR_GROUPS_PER_COHORT = 2;
const MINIMUM_TOPIC_COUNT = 2;

/**
 * Generates the reference-data view for a profile.
 *
 * @param {{seed: number, yearGroupCount: number}} profileDefinition Resolved profile definition.
 * @returns {{cohorts: Array<object>, yearGroups: Array<object>, assignmentTopics: Array<object>}} Reference data whose keys are internally resolvable.
 */
export function generateReferenceData(profileDefinition) {
  const yearGroups = [];
  for (let index = 0; index < profileDefinition.yearGroupCount; index += 1) {
    const year = FIRST_YEAR_GROUP + index;
    yearGroups.push({ key: `year-group-${year}`, name: `Year ${year}` });
  }

  const cohortCount = Math.max(
    1,
    Math.ceil(profileDefinition.yearGroupCount / YEAR_GROUPS_PER_COHORT)
  );
  const cohorts = [];
  for (let index = 0; index < cohortCount; index += 1) {
    cohorts.push({
      key: `cohort-${index}`,
      name: `Synthetic Cohort ${index + 1}`,
      active: true,
      startYear: 2024,
      startMonth: 9,
    });
  }

  const topicCount = Math.max(MINIMUM_TOPIC_COUNT, profileDefinition.yearGroupCount);
  const assignmentTopics = [];
  for (let index = 0; index < topicCount; index += 1) {
    const firstIndex = index % yearGroups.length;
    const secondIndex = (index + 1) % yearGroups.length;
    const firstYearGroup = yearGroups.at(firstIndex);
    const secondYearGroup = yearGroups.at(secondIndex);
    const yearGroupKeys =
      firstYearGroup === secondYearGroup
        ? [firstYearGroup.key]
        : [firstYearGroup.key, secondYearGroup.key];
    assignmentTopics.push({
      key: `topic-${index}`,
      name: `Synthetic Topic ${index + 1}`,
      yearGroupKeys,
    });
  }

  return { cohorts, yearGroups, assignmentTopics };
}
