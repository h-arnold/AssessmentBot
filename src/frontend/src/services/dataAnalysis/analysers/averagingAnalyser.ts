import type {
  AveragingAnalyserInput,
  AveragingResult,
  MetricResult,
  PerStudentRow,
  PerTaskRow,
  PerClassResult,
} from '../dataAnalysis.zod';

/**
 * Default criterion weightings: completeness=0.4, accuracy=0.4, spag=0.2.
 * Set in the constructor only (AGENTS §11 / frontend §11).
 */
const DEFAULT_CRITERION_WEIGHTINGS = { completeness: 0.4, accuracy: 0.4, spag: 0.2 } as const;

/** Per-criterion weightings configurable at construction time. */
interface CriterionWeightings {
  completeness: number;
  accuracy: number;
  spag: number;
}

/** Mutable accumulator for computing a weighted metric. */
interface MetricAccumulator {
  weightedSum: number;
  totalWeight: number;
  applicableDataPoints: number;
  totalDataPoints: number;
}

/** Accumulator set for all four metrics (completeness, accuracy, spag, overall). */
interface DataPointAccumulator {
  completeness: MetricAccumulator;
  accuracy: MetricAccumulator;
  spag: MetricAccumulator;
  overall: MetricAccumulator;
}

/** A nullable numeric assessment score — number, 'N' (not applicable), or absent. */
type AssessmentScore = number | 'N' | undefined;

/**
 * Create a zeroed-out metric accumulator.
 *
 * @returns {MetricAccumulator} A fresh entry with all fields at zero.
 */
function createAccumulator(): MetricAccumulator {
  return { weightedSum: 0, totalWeight: 0, applicableDataPoints: 0, totalDataPoints: 0 };
}

/**
 * Create a zeroed-out data-point accumulator set.
 *
 * @returns {DataPointAccumulator} A fresh entry with all sub-accumulators at zero.
 */
function createDataPointAccumulator(): DataPointAccumulator {
  return {
    completeness: createAccumulator(),
    accuracy: createAccumulator(),
    spag: createAccumulator(),
    overall: createAccumulator(),
  };
}

/**
 * Convert a metric accumulator to its output MetricResult shape.
 *
 * @param {MetricAccumulator} accumulator - The mutable accumulator to convert.
 * @returns {MetricResult} A read-only MetricResult snapshot.
 */
function accumToMetric(accumulator: MetricAccumulator): MetricResult {
  return {
    value:
      accumulator.applicableDataPoints === 0
        ? null
        : accumulator.weightedSum / accumulator.totalWeight,
    totalWeight: accumulator.totalWeight,
    applicableDataPoints: accumulator.applicableDataPoints,
    totalDataPoints: accumulator.totalDataPoints,
  };
}

/**
 * Pure synchronous class that computes weighted averages for completeness,
 * accuracy, SPaG, and overall metrics.
 *
 * @remarks
 * The analyser trusts its input is already Zod-validated by the orchestrator.
 * Task-weighting resolution avoids N+1 {@code getAssignmentDefinition} calls
 * by cross-referencing the pre-fetched {@code assignmentDefinitionPartials}
 * collection.
 *
 * SPaG {@code 'N'} causes renormalisation of the overall metric denominator
 * (the criterion weight for SPaG is excluded from both numerator and
 * denominator).
 *
 * All output arrays are deterministically sorted for testability:
 * - {@code perStudent}: {@code studentName} asc, then {@code studentId} asc
 *   tie-breaker
 * - {@code perTask}: {@code (definitionKey, taskId)} asc
 * - {@code AveragingResult[]}: {@code classId} asc
 */
export class AveragingAnalyser {
  private readonly criterionWeightings: CriterionWeightings;

  private readonly appliedCriterionWeightings: CriterionWeightings;

  /**
   * Constructs an AveragingAnalyser with the given criterion weightings.
   *
   * @param {CriterionWeightings} [criterionWeightings] - Optional weighting overrides.
   *   Defaults to `{ completeness: 0.4, accuracy: 0.4, spag: 0.2 }`.
   *   Defaults are set in the constructor only.
   */
  constructor(criterionWeightings?: CriterionWeightings) {
    const resolved = criterionWeightings ?? DEFAULT_CRITERION_WEIGHTINGS;
    this.criterionWeightings = resolved;
    this.appliedCriterionWeightings = { ...resolved };
  }

  /**
   * Run the averaging analysis over the provided input.
   *
   * @param {AveragingAnalyserInput} input - Fully assembled input data.
   * @returns {AveragingResult[]} An array of per-class results sorted by classId.
   */
  analyse(input: AveragingAnalyserInput): AveragingResult[] {
    const sortedClasses = [...input.classes].toSorted((a, b) => a.classId.localeCompare(b.classId));

    return sortedClasses.map((cls) => this.analyseClass(cls, input));
  }

  /**
   * Analyse a single class and produce its AveragingResult.
   *
   * @param {AveragingAnalyserInput['classes'][number]} cls - The class data.
   * @param {AveragingAnalyserInput} input - The full analyser input.
   * @returns {AveragingResult} The per-class analysis result.
   */
  private analyseClass(
    cls: AveragingAnalyserInput['classes'][number],
    input: AveragingAnalyserInput
  ): AveragingResult {
    const filteredAssignments = this.filterAssignments(cls, input);
    const accumulators = this.accumulateDataPoints(filteredAssignments, input);

    const perStudent = this.buildPerStudentRows(accumulators.studentAccums);
    const perTask = this.buildPerTaskRows(accumulators.taskAccums);
    const perClass: PerClassResult = {
      completeness: accumToMetric(accumulators.classAccum.completeness),
      accuracy: accumToMetric(accumulators.classAccum.accuracy),
      spag: accumToMetric(accumulators.classAccum.spag),
      overall: accumToMetric(accumulators.classAccum.overall),
    };

    return {
      classId: cls.classId,
      className: cls.className,
      perStudent,
      perTask,
      perClass,
      appliedCriterionWeightings: { ...this.appliedCriterionWeightings },
    };
  }

  /**
   * Filter a class's assignments by dateRange, topicKeys, and
   * assignmentDefinitionKeys. Throws if any assignment lacks a definition.
   *
   * @param {AveragingAnalyserInput['classes'][number]} cls - The class.
   * @param {AveragingAnalyserInput} input - The full analyser input.
   * @returns {AveragingAnalyserInput['classes'][number]['assignments']}
   *   Filtered assignments.
   */
  private filterAssignments(
    cls: AveragingAnalyserInput['classes'][number],
    input: AveragingAnalyserInput
  ): AveragingAnalyserInput['classes'][number]['assignments'] {
    return cls.assignments.filter((assignment) => {
      this.assertAssignmentDefinition(assignment, cls.classId);

      const definition = assignment.assignmentDefinition!;

      if (this.isFilteredByDateRange(assignment.createdAt, input.filter.dateRange)) {
        return false;
      }

      if (this.isFilteredByTopicKeys(definition.primaryTopicKey, input.filter.topicKeys)) {
        return false;
      }

      if (
        this.isFilteredByDefinitionKeys(
          definition.definitionKey,
          input.filter.assignmentDefinitionKeys
        )
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * Assert that an assignment has an assignmentDefinition.
   *
   * @param {AveragingAnalyserInput['classes'][number]['assignments'][number]}
   *   assignment - The assignment to check.
   * @param {string} classId - The class identifier for error context.
   * @throws When the assignment lacks a definition.
   */
  private assertAssignmentDefinition(
    assignment: AveragingAnalyserInput['classes'][number]['assignments'][number],
    classId: string
  ): void {
    if (!assignment.assignmentDefinition) {
      throw new Error(
        `Missing assignmentDefinition for class ${classId}, ` +
          `assignment ${assignment.assignmentId}`
      );
    }
  }

  /**
   * Check whether a createdAt timestamp is excluded by the date-range filter.
   *
   * @param {string} createdAt - The ISO timestamp to check.
   * @param {{ from: string; to: string } | undefined} dateRange - The range.
   * @returns {boolean} True when the timestamp falls outside [from, to).
   */
  private isFilteredByDateRange(
    createdAt: string,
    dateRange: { from: string; to: string } | undefined
  ): boolean {
    if (!dateRange) return false;
    return createdAt < dateRange.from || createdAt >= dateRange.to;
  }

  /**
   * Check whether a primary topic key is excluded by the topic-key filter.
   *
   * @param {string} primaryTopicKey - The topic key to check.
   * @param {readonly string[] | undefined} topicKeys - The allow list.
   * @returns {boolean} True when the key is not in the allow list.
   */
  private isFilteredByTopicKeys(
    primaryTopicKey: string,
    topicKeys: readonly string[] | undefined
  ): boolean {
    if (!topicKeys || topicKeys.length === 0) return false;
    return !topicKeys.includes(primaryTopicKey);
  }

  /**
   * Check whether a definition key is excluded by the definition-key filter.
   *
   * @param {string} definitionKey - The definition key to check.
   * @param {readonly string[] | undefined} assignmentDefinitionKeys - Allow list.
   * @returns {boolean} True when the key is not in the allow list.
   */
  private isFilteredByDefinitionKeys(
    definitionKey: string,
    assignmentDefinitionKeys: readonly string[] | undefined
  ): boolean {
    if (!assignmentDefinitionKeys || assignmentDefinitionKeys.length === 0) {
      return false;
    }
    return !assignmentDefinitionKeys.includes(definitionKey);
  }

  /**
   * Pre-register tasks so entries with zero submissions appear in perTask.
   *
   * @param {ReadonlyArray<{ id: string }>} tasks - The tasks array.
   * @param {string} definitionKey - The definition key.
   * @param {Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>}
   *   taskAccums - The task accumulation map (mutated).
   */
  private preRegisterTasks(
    tasks: ReadonlyArray<{ id: string }>,
    definitionKey: string,
    taskAccums: Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>
  ): void {
    for (const task of tasks) {
      const taskKey = `${definitionKey}::${task.id}`;
      if (!taskAccums.has(taskKey)) {
        taskAccums.set(taskKey, {
          definitionKey,
          taskId: task.id,
          ...createDataPointAccumulator(),
        });
      }
    }
  }

  /**
   * Process one submission item, accumulating metrics into all three scopes.
   *
   * @param {AssessmentScore} completenessScore - The completeness score.
   * @param {AssessmentScore} accuracyScore - The accuracy score.
   * @param {AssessmentScore} spagScore - The SPaG score.
   * @param {number} weight - The per-data-point weight.
   * @param {DataPointAccumulator} studentAccum - Per-student accumulator.
   * @param {DataPointAccumulator} classAccum - Per-class accumulator.
   * @param {DataPointAccumulator} taskAccum - Per-task accumulator.
   */
  private processSubmissionItem(
    completenessScore: AssessmentScore,
    accuracyScore: AssessmentScore,
    spagScore: AssessmentScore,
    weight: number,
    studentAccum: DataPointAccumulator,
    classAccum: DataPointAccumulator,
    taskAccum: DataPointAccumulator
  ): void {
    const overallValue = this.computeOverall(completenessScore, accuracyScore, spagScore);

    this.accumulateMetricsToTarget(
      studentAccum,
      completenessScore,
      accuracyScore,
      spagScore,
      overallValue,
      weight
    );
    this.accumulateMetricsToTarget(
      classAccum,
      completenessScore,
      accuracyScore,
      spagScore,
      overallValue,
      weight
    );
    this.accumulateMetricsToTarget(
      taskAccum,
      completenessScore,
      accuracyScore,
      spagScore,
      overallValue,
      weight
    );
  }

  /**
   * Process a single assignment, accumulating its submission data.
   *
   * @param {AveragingAnalyserInput['classes'][number]['assignments'][number]}
   *   assignment - The assignment to process.
   * @param {number} assignmentWeighting - The resolved assignment weighting.
   * @param {string} definitionKey - The assignment definition key.
   * @param {AveragingAnalyserInput} input - Full analyser input.
   * @param {Map<string, { studentName: string | null } & DataPointAccumulator>}
   *   studentAccums - Per-student accumulators (mutated).
   * @param {Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>}
   *   taskAccums - Per-task accumulators (mutated).
   * @param {DataPointAccumulator} classAccum - Per-class accumulator (mutated).
   */
  private processAssignment(
    assignment: AveragingAnalyserInput['classes'][number]['assignments'][number],
    assignmentWeighting: number,
    definitionKey: string,
    input: AveragingAnalyserInput,
    studentAccums: Map<string, { studentName: string | null } & DataPointAccumulator>,
    taskAccums: Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>,
    classAccum: DataPointAccumulator
  ): void {
    const { assignmentDefinitionPartials } = input;

    for (const submission of assignment.submissions) {
      const { studentId, studentName, items } = submission;
      const studentAccum = this.getOrCreateStudentAccum(studentAccums, studentId, studentName);

      for (const [taskId, item] of Object.entries(items)) {
        const taskWeighting = this.resolveTaskWeight(
          definitionKey,
          taskId,
          assignmentDefinitionPartials
        );

        const weight = assignmentWeighting * taskWeighting;
        if (weight === 0) {
          continue;
        }

        const taskAccum = this.getOrCreateTaskAccum(taskAccums, definitionKey, taskId);

        this.processItemAssessments(item, weight, studentAccum, classAccum, taskAccum);
      }
    }
  }

  /**
   * Get or create a per-student accumulator for the given student.
   *
   * @param {Map<string, { studentName: string | null } & DataPointAccumulator>}
   *   studentAccums - The accumulators map.
   * @param {string} studentId - The student identifier.
   * @param {string | null} studentName - The student display name.
   * @returns {DataPointAccumulator} The existing or new accumulator.
   */
  private getOrCreateStudentAccum(
    studentAccums: Map<string, { studentName: string | null } & DataPointAccumulator>,
    studentId: string,
    studentName: string | null
  ): DataPointAccumulator {
    if (!studentAccums.has(studentId)) {
      studentAccums.set(studentId, {
        studentName,
        ...createDataPointAccumulator(),
      });
    }
    return studentAccums.get(studentId)!;
  }

  /**
   * Get or create a per-task accumulator for the given task.
   *
   * @param {Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>}
   *   taskAccums - The accumulators map.
   * @param {string} definitionKey - The definition key.
   * @param {string} taskId - The task identifier.
   * @returns {DataPointAccumulator} The existing or new accumulator.
   */
  private getOrCreateTaskAccum(
    taskAccums: Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>,
    definitionKey: string,
    taskId: string
  ): DataPointAccumulator {
    const taskKey = `${definitionKey}::${taskId}`;
    if (!taskAccums.has(taskKey)) {
      taskAccums.set(taskKey, {
        definitionKey,
        taskId,
        ...createDataPointAccumulator(),
      });
    }
    return taskAccums.get(taskKey)!;
  }

  /**
   * Extract assessment scores from a submission item and apply them to all
   * three accumulator scopes.
   *
   * @param {AveragingAnalyserInput['classes'][number]['assignments'][number]['submissions'][number]['items'][string]}
   *   item - The submission item.
   * @param {number} weight - The per-data-point weight.
   * @param {DataPointAccumulator} studentAccum - Per-student accumulator.
   * @param {DataPointAccumulator} classAccum - Per-class accumulator.
   * @param {DataPointAccumulator} taskAccum - Per-task accumulator.
   */
  private processItemAssessments(
    item: AveragingAnalyserInput['classes'][number]['assignments'][number]['submissions'][number]['items'][string],
    weight: number,
    studentAccum: DataPointAccumulator,
    classAccum: DataPointAccumulator,
    taskAccum: DataPointAccumulator
  ): void {
    const { assessments } = item;
    const assessmentsOrEmpty = assessments ?? {};
    const completenessScore: AssessmentScore = assessmentsOrEmpty.completeness?.score;
    const accuracyScore: AssessmentScore = assessmentsOrEmpty.accuracy?.score;
    const spagScore: AssessmentScore = assessmentsOrEmpty.spag?.score;

    this.processSubmissionItem(
      completenessScore,
      accuracyScore,
      spagScore,
      weight,
      studentAccum,
      classAccum,
      taskAccum
    );
  }

  /**
   * Accumulate data points across all filtered assignments.
   *
   * @param {AveragingAnalyserInput['classes'][number]['assignments']}
   *   filteredAssignments - The in-scope assignments after filtering.
   * @param {AveragingAnalyserInput} input - Full analyser input.
   * @returns {{
   *   studentAccums: Map<string, { studentName: string | null } & DataPointAccumulator>,
   *   taskAccums: Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>,
   *   classAccum: DataPointAccumulator
   * }} The three accumulator containers.
   */
  private accumulateDataPoints(
    filteredAssignments: AveragingAnalyserInput['classes'][number]['assignments'],
    input: AveragingAnalyserInput
  ): {
    studentAccums: Map<string, { studentName: string | null } & DataPointAccumulator>;
    taskAccums: Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>;
    classAccum: DataPointAccumulator;
  } {
    const studentAccums = new Map<string, { studentName: string | null } & DataPointAccumulator>();

    const taskAccums = new Map<
      string,
      { definitionKey: string; taskId: string } & DataPointAccumulator
    >();

    const classAccum = createDataPointAccumulator();

    for (const assignment of filteredAssignments) {
      const definition = assignment.assignmentDefinition!;
      const { assignmentWeighting, definitionKey, tasks } = definition;
      const resolvedAssignmentWeighting = assignmentWeighting ?? 1;

      this.preRegisterTasks(tasks ?? [], definitionKey, taskAccums);

      this.processAssignment(
        assignment,
        resolvedAssignmentWeighting,
        definitionKey,
        input,
        studentAccums,
        taskAccums,
        classAccum
      );
    }

    return { studentAccums, taskAccums, classAccum };
  }

  /**
   * Accumulate all four metrics into a single target accumulator for one
   * data point.
   *
   * @param {DataPointAccumulator} target - The accumulator to update.
   * @param {AssessmentScore} completenessScore - Completeness score.
   * @param {AssessmentScore} accuracyScore - Accuracy score.
   * @param {AssessmentScore} spagScore - SPaG score.
   * @param {number | null} overallValue - Pre-computed overall.
   * @param {number} weight - Per-data-point weight.
   */
  private accumulateMetricsToTarget(
    target: DataPointAccumulator,
    completenessScore: AssessmentScore,
    accuracyScore: AssessmentScore,
    spagScore: AssessmentScore,
    overallValue: number | null,
    weight: number
  ): void {
    target.completeness.totalDataPoints++;
    if (typeof completenessScore === 'number') {
      target.completeness.weightedSum += completenessScore * weight;
      target.completeness.totalWeight += weight;
      target.completeness.applicableDataPoints++;
    }

    target.accuracy.totalDataPoints++;
    if (typeof accuracyScore === 'number') {
      target.accuracy.weightedSum += accuracyScore * weight;
      target.accuracy.totalWeight += weight;
      target.accuracy.applicableDataPoints++;
    }

    target.spag.totalDataPoints++;
    if (typeof spagScore === 'number') {
      target.spag.weightedSum += spagScore * weight;
      target.spag.totalWeight += weight;
      target.spag.applicableDataPoints++;
    }

    target.overall.totalDataPoints++;
    if (overallValue !== null) {
      target.overall.weightedSum += overallValue * weight;
      target.overall.totalWeight += weight;
      target.overall.applicableDataPoints++;
    }
  }

  /**
   * Compute the overall value for a single data point, renormalising when
   * criteria are 'N' (not applicable).
   *
   * @param {AssessmentScore} completenessScore - The completeness score.
   * @param {AssessmentScore} accuracyScore - The accuracy score.
   * @param {AssessmentScore} spagScore - The SPaG score.
   * @returns {number | null} The weighted overall, or null if all criteria
   *   are unavailable.
   */
  private computeOverall(
    completenessScore: AssessmentScore,
    accuracyScore: AssessmentScore,
    spagScore: AssessmentScore
  ): number | null {
    const cw = this.criterionWeightings;
    let numerator = 0;
    let denominator = 0;

    if (typeof completenessScore === 'number') {
      numerator += cw.completeness * completenessScore;
      denominator += cw.completeness;
    }
    if (typeof accuracyScore === 'number') {
      numerator += cw.accuracy * accuracyScore;
      denominator += cw.accuracy;
    }
    if (typeof spagScore === 'number') {
      numerator += cw.spag * spagScore;
      denominator += cw.spag;
    }

    if (denominator === 0) return null;
    return numerator / denominator;
  }

  /**
   * Build sorted per-student rows from accumulators.
   *
   * @param {Map<string, { studentName: string | null } & DataPointAccumulator>}
   *   studentAccums - Map of studentId to accumulator data.
   * @returns {PerStudentRow[]} Sorted per-student result rows.
   */
  private buildPerStudentRows(
    studentAccums: Map<string, { studentName: string | null } & DataPointAccumulator>
  ): PerStudentRow[] {
    const rows: PerStudentRow[] = [];

    for (const [studentId, accumulator] of studentAccums) {
      rows.push({
        studentId,
        studentName: accumulator.studentName,
        completeness: accumToMetric(accumulator.completeness),
        accuracy: accumToMetric(accumulator.accuracy),
        spag: accumToMetric(accumulator.spag),
        overall: accumToMetric(accumulator.overall),
      });
    }

    return rows.toSorted((a, b) => {
      const nameComparison = (a.studentName ?? '').localeCompare(b.studentName ?? '');
      if (nameComparison !== 0) return nameComparison;
      return a.studentId.localeCompare(b.studentId);
    });
  }

  /**
   * Build sorted per-task rows from accumulators.
   *
   * @param {Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>}
   *   taskAccums - Map of composite key to accumulator data.
   * @returns {PerTaskRow[]} Sorted per-task result rows.
   */
  private buildPerTaskRows(
    taskAccums: Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>
  ): PerTaskRow[] {
    const rows: PerTaskRow[] = [];

    for (const [, accumulator] of taskAccums) {
      rows.push({
        definitionKey: accumulator.definitionKey,
        taskId: accumulator.taskId,
        taskTitle: null,
        completeness: accumToMetric(accumulator.completeness),
        accuracy: accumToMetric(accumulator.accuracy),
        spag: accumToMetric(accumulator.spag),
        overall: accumToMetric(accumulator.overall),
      });
    }

    return rows.toSorted((a, b) => {
      const definitionComparison = a.definitionKey.localeCompare(b.definitionKey);
      if (definitionComparison !== 0) return definitionComparison;
      return a.taskId.localeCompare(b.taskId);
    });
  }

  /**
   * Resolve the task weighting by cross-referencing the pre-fetched
   * assignmentDefinitionPartials collection.
   *
   * @param {string} definitionKey - The assignment definition key.
   * @param {string} taskId - The task identifier.
   * @param {ReadonlyArray<{ definitionKey: string; tasks?: ReadonlyArray<{ id: string; taskWeighting: number }> }>}
   *   assignmentDefinitionPartials - The pre-fetched partials.
   * @returns {number} The resolved task weighting, or `1` if no match.
   */
  private resolveTaskWeight(
    definitionKey: string,
    taskId: string,
    assignmentDefinitionPartials: ReadonlyArray<{
      definitionKey: string;
      tasks?: ReadonlyArray<{ id: string; taskWeighting: number }>;
    }>
  ): number {
    const definitionPartial = assignmentDefinitionPartials.find(
      (d) => d.definitionKey === definitionKey
    );
    if (!definitionPartial) return 1;

    const tasks = definitionPartial.tasks ?? [];
    const task = tasks.find((t) => t.id === taskId);
    return task?.taskWeighting ?? 1;
  }
}
