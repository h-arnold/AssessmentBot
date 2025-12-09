# Assignment Metadata Migration – Action Plan

## Sequenced Tasks

1. **Model definition**: Add `AssignmentMetadata` class (Model) with full/partial JSON, validation, artifact redaction, and TaskDefinition reconstruction.
2. **Assignment wiring**: Update `Assignment` to own `assignmentMetadata`; proxy tasks/weighting/doc IDs/titles/topics; adapt `toJSON`/`fromJSON`/`toPartialJSON`; maintain backward-compatible fields.
3. **Db helpers**: Extend `AssignmentDbManager` (or new helper) with `saveMetadata`, `getMetadataByTitle`, `getMetadataByCourseAndId`, using `assignment_metadata` collection keyed by `primaryTitle` and containing courseId/assignmentId for disambiguation.
4. **Properties manager swap**: Refactor `AssignmentPropertiesManager` to read/write via JsonDbApp metadata helpers; preserve MIME/type validation using DriveApp; remove Script Properties writes.
5. **Controllers and processors**: Update `initController`, `AssignmentProcessor` routes, and any consumer of `AssignmentPropertiesManager` to fetch metadata (doc IDs, documentType, tasks) via JsonDbApp; ensure lazy-load check against stored `referenceLastModified`/`templateLastModified` before parsing.
6. **Migration script (one-off)**: Implement Apps Script runnable that reads legacy Script Properties `assignment_*`, builds `AssignmentMetadata` (doc IDs, documentType, titles/topics if available, empty tasks), saves to JsonDbApp, and deletes legacy keys upon success; log via ProgressTracker.
7. **Lazy-load plumbing**: When launching an assessment, compare Drive modifiedTime vs metadata `referenceLastModified`/`templateLastModified`; skip parsing if unchanged and tasks present; update timestamps/tasks when re-parsed.
8. **Tests**: Update assignment serialisation tests for metadata; add tests for metadata helpers and migration logic using mocks; ensure partial JSON redaction expectations; adjust data-shape fixtures.
9. **Docs**: Revise `docs/developer/DATA_SHAPES.md` and how-to/release notes to describe `assignment_metadata` collection, `primaryTitle` keying, and migration steps.

## Dependencies / Ordering

- Complete steps 1–3 before controller refactors.
- Migration script (6) depends on model + db helpers.
- Lazy-load logic (7) depends on metadata timestamps and controller access to Drive modifiedTime.

## Risks & Mitigations

- **Title collisions**: `primaryTitle` key must validate matching `courseId`/`assignmentId` before overwrite; log and throw on mismatch.
- **Legacy data gaps**: If legacy properties lack documentType, default to SLIDES; log missing IDs and skip record rather than writing partial broken metadata.
- **Parsing divergence**: Ensure partial JSON redaction mirrors Assignment’s behaviour to avoid test regressions.
- **Trigger flows**: Verify any trigger setup/load that previously read DocumentProperties now sources from JsonDbApp; add unit coverage where possible.

## Deliverables

- New model + db helper code.
- Refactored Assignment and controllers to metadata.
- One-off migration script (Apps Script entry point) with logging.
- Updated tests and docs.
