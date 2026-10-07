import type {
  AssessmentSchema,
  AssignmentFull,
  BaseTaskArtifactSchema,
} from '../../services/assignmentAssessment/assignmentAssessment.zod';
import { HEATMAP_METRIC_KEYS } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import { buildTaskKey } from '../../services/dataAnalysis/taskKey';
import type { HeatmapMetricKey } from '../../services/dataAnalysis/metricDisplay/metricDisplayMeta';
import type { z } from 'zod';

/**
 * Assessment shape, derived from {@link AssessmentSchema} so the two cannot
 * drift. Mirrors `Assessment.toJSON()` in `src/backend/Models/Assessment.js`.
 */
type Assessment = z.infer<typeof AssessmentSchema>;

/**
 * Discriminant values for a task artifact's type, derived from the
 * {@link BaseTaskArtifactSchema} discriminated union so the two cannot drift.
 */
type ArtifactType = z.infer<typeof BaseTaskArtifactSchema>['type'];

/**
 * Maps each `ArtifactType` to its corresponding `artifactContent` type.
 */
type ArtifactContentByType<T extends ArtifactType> = T extends 'SPREADSHEET'
  ? Array<Array<string | number | null>> | null
  : T extends 'base'
    ? unknown
    : string | null;

/**
 * Per-cell preview data extracted from a single (student, task) pair in
 * the AssignmentFull payload.
 *
 * Discriminated union keyed on `artifactType` so that `artifactContent`
 * narrows automatically when the type is checked.
 */
export type CellPreviewData = {
  [K in ArtifactType]: {
    readonly artifactType: K;
    readonly artifactContent: ArtifactContentByType<K>;
    /** Per-metric reasoning strings (null when assessment is absent for that metric). */
    readonly reasoning: Record<HeatmapMetricKey, string | null>;
    /**
     * Derived editor source link for this submission artefact, resolved in the
     * lookup; `null` when the source is unavailable. Never persisted and never
     * added to an API response.
     */
    readonly sourceUrl: string | null;
  };
}[ArtifactType];

/**
 * Keyed lookup: outer key is studentId, inner key is the composite `taskKey`
 * (`` `${definitionKey}::${taskId}` ``).
 *
 * A missing student entry or taskKey entry means no submission exists for that
 * (student, task) pair. O(1) retrieval via two Map.get calls. The inner key is
 * composite so that two assignment instances sharing one definition key no
 * longer collide on the bare `taskId` (see the `@remarks` block on
 * {@link buildCellPreviewLookup} for the full rationale).
 */
export type CellPreviewLookup = ReadonlyMap<string, ReadonlyMap<string, CellPreviewData>>;

/**
 * Trim a stored identifier, treating `null`, an absent key, an empty string
 * and a whitespace-only string as unusable.
 *
 * @param {string | null | undefined} value - A stored document or page identifier.
 * @returns {string | null} The trimmed identifier, or `null` when unusable.
 */
function trimStoredId(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Build the fixed HTTPS Google editor URL parts for one usable document ID.
 *
 * @remarks
 * The path comes from the root assignment's `documentType` only; anything
 * other than `SLIDES` or `SHEETS` (including `null`) yields `null`. The
 * fragment prefix (`#slide=id.` or `#gid=`) shares this single format
 * decision, so callers can append an encoded page ID without re-deriving it.
 *
 * @param {string | null} documentType - Root assignment document format.
 * @param {string} documentId - Usable, already-trimmed document ID.
 * @returns {{ baseUrl: string; fragmentPrefix: string } | null} The document-root
 *   editor URL and its fragment prefix, or `null` when the format is unsupported.
 */
function buildEditorBaseUrl(
  documentType: string | null,
  documentId: string
): { baseUrl: string; fragmentPrefix: string } | null {
  if (documentType === 'SLIDES') {
    return {
      baseUrl: `https://docs.google.com/presentation/d/${encodeURIComponent(documentId)}/edit`,
      fragmentPrefix: '#slide=id.',
    };
  }
  if (documentType === 'SHEETS') {
    return {
      baseUrl: `https://docs.google.com/spreadsheets/d/${encodeURIComponent(documentId)}/edit`,
      fragmentPrefix: '#gid=',
    };
  }
  return null;
}

/**
 * Resolve the derived editor source URL for one submission item (issue #19).
 *
 * @remarks
 * Pure and private to this module. The format comes from the root full
 * assignment's `documentType` (`SLIDES` or `SHEETS`), never from the artefact's
 * content type. The document ID is the artefact's when usable, otherwise the
 * parent submission's; both are trimmed and encoded as URL components against a
 * fixed HTTPS Google Docs editor host and path. The artefact's page ID supplies
 * the fragment anchor (trimmed and encoded; the Sheets value `"0"` is valid);
 * an unusable page ID yields the document-root `/edit` URL with no fragment.
 * An unsupported or null format, or no usable document ID at all, yields
 * `null`. Reference/template documents, image-export `metadata.sourceUrl` and
 * definition task page IDs are never consulted.
 *
 * @param {string | null} documentType - Root assignment document format.
 * @param {string | null} artifactDocumentId - Stored artefact document ID.
 * @param {string | null} artifactPageId - Stored artefact page ID.
 * @param {string | null | undefined} parentDocumentId - Stored parent submission document ID.
 * @returns {string | null} The derived editor URL, or `null` when unavailable.
 */
function resolveSourceUrl(
  documentType: string | null,
  artifactDocumentId: string | null,
  artifactPageId: string | null,
  parentDocumentId: string | null | undefined
): string | null {
  const documentId = trimStoredId(artifactDocumentId) ?? trimStoredId(parentDocumentId);
  if (documentId == null) {
    return null;
  }
  const editor = buildEditorBaseUrl(documentType, documentId);
  if (editor == null) {
    return null;
  }

  const pageId = trimStoredId(artifactPageId);
  if (pageId == null) {
    return editor.baseUrl;
  }

  return `${editor.baseUrl}${editor.fragmentPrefix}${encodeURIComponent(pageId)}`;
}

/**
 * Builds a `CellPreviewData` from a single submission item's artifact and assessments.
 *
 * @param {ArtifactType} artifactType - The artifact type discriminator.
 * @param {unknown} artifactContent - The artifact content.
 * @param {Record<string, Assessment>} assessments - The per-metric assessments.
 * @param {string | null} sourceUrl - The derived editor source URL for this item.
 * @returns {CellPreviewData} The assembled cell preview data.
 */
function createCellPreviewData(
  artifactType: ArtifactType,
  artifactContent: unknown,
  assessments: Record<string, Assessment>,
  sourceUrl: string | null
): CellPreviewData {
  return {
    artifactType,
    artifactContent,
    // `assessments` is keyed by backend metric names (`completeness`,
    // `accuracy`, `spag`). `HEATMAP_METRIC_KEYS` provides the same three
    // keys used for lookup. If a metric key is absent, `reasoning` defaults
    // to `null`.
    reasoning: Object.fromEntries(
      HEATMAP_METRIC_KEYS.map((key) => [key, assessments[key]?.reasoning ?? null])
    ) as Record<HeatmapMetricKey, string | null>,
    sourceUrl,
  } as CellPreviewData;
}

/**
 * Transforms an `AssignmentFull` payload into a `Map<studentId, Map<taskKey, CellPreviewData>>`
 * for O(1) popover lookup, where `taskKey` is the composite `` `${definitionKey}::${taskId}` ``.
 *
 * @param {AssignmentFull} assignment - The full assignment payload (must be non-null; caller guards null).
 * @returns {CellPreviewLookup} A read-only Map keyed by studentId → taskKey → CellPreviewData.
 *
 * @remarks
 * The inner key is the composite `taskKey`, not the bare `taskId`. The
 * `definitionKey` is derived internally from the payload's embedded
 * `assignmentDefinition.definitionKey` (present on `AssignmentFull`), so the
 * lookup keys line up with the heatmap column `taskKey`s produced by
 * `adaptMetricsToHeatmap`.
 *
 * Two reasons justify the composite key:
 *
 * 1. **Cross-fetch invariant.** The embedded popover path relies on
 *    `getABClass.assignments[].assignmentDefinitionKey` (class-fetch side)
 *    equalling `getAssignment.assignmentDefinition.definitionKey` (assignment-fetch
 *    side) for the same assignment. The backend guarantees this today because the
 *    class mapper derives `assignmentDefinitionKey` from the very same embedded
 *    definition document (`src/backend/y_controllers/ABClassController/ABClassResponseMapper.js:88`).
 *    Keying the lookup by the composite `taskKey` therefore keeps the embedded
 *    flow correct once keys widen, and the invariant is pinned by a dedicated
 *    cross-fetch parity test.
 * 2. **Collision elimination.** Two assignment instances that share one
 *    definition key would otherwise merge their submissions under identical bare
 *    `taskId`s; the composite key keeps each instance's cells distinct.
 */
export function buildCellPreviewLookup(assignment: AssignmentFull): CellPreviewLookup {
  const definitionKey = assignment.assignmentDefinition.definitionKey;

  const outerMap = new Map<string, Map<string, CellPreviewData>>();

  for (const submission of assignment.submissions) {
    const innerMap = new Map<string, CellPreviewData>();

    for (const item of Object.values(submission.items)) {
      const taskKey = buildTaskKey(definitionKey, item.taskId);
      // First-wins: only set if this taskKey has not been encountered yet
      if (!innerMap.has(taskKey)) {
        const sourceUrl = resolveSourceUrl(
          assignment.documentType,
          item.artifact.documentId,
          item.artifact.pageId,
          submission.documentId
        );
        innerMap.set(
          taskKey,
          createCellPreviewData(
            item.artifact.type,
            item.artifact.content,
            item.assessments,
            sourceUrl
          )
        );
      }
    }

    outerMap.set(submission.studentId, innerMap);
  }

  return outerMap;
}
