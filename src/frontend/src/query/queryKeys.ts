export const queryKeys = {
  assignmentDefinitionByKey: (definitionKey: string) =>
    ['assignmentDefinitionByKey', definitionKey] as const,
  assignmentDefinitionPartials: () => ['assignmentDefinitionPartials'] as const,
  assignmentTopics: () => ['assignmentTopics'] as const,
  authorisationStatus: () => ['authorisationStatus'] as const,
  backendConfig: () => ['backendConfig'] as const,
  classPartials: () => ['classPartials'] as const,
  cohorts: () => ['cohorts'] as const,
  googleClassrooms: () => ['googleClassrooms'] as const,
  yearGroups: () => ['yearGroups'] as const,
};
