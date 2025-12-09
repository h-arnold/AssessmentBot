# Assignment Definition Action Plan

## Sequenced Tasks

1. **Model Definition**: Create `AssignmentDefinition` class.
   - Fields: `primaryTitle`, `primaryTopic`, doc IDs, timestamps, weighting, `tasks`.
   - Methods: `toJSON`, `fromJSON`, `toPartialJSON` (redaction).
   - Validation: Ensure title/topic/docIDs are present.

2. **Controller**: Create `AssignmentDefinitionController`.
   - **Responsibility:** CRUD for `AssignmentDefinition` and migration orchestration.
   - **Dependencies:** `DbManager` (for `assignment_definitions` collection).
   - **Methods:**
     - `saveDefinition(def)`
     - `getDefinition(title, topic)`
     - `getOrMigrateDefinition(title, topic, legacyData)`: The core logic for lazy migration.

3. **Assignment Refactor**: Update `Assignment` class.
   - Add `assignmentDefinition` property.
   - Delegate `tasks`, `weighting`, `documentType` to the definition.
   - Update `toJSON`/`fromJSON` to handle the nested definition.

4. **Legacy Migration & Enrichment Logic**:
   - Implement the logic within `AssignmentDefinitionController.getOrMigrateDefinition`.
   - Logic:
     - Try fetch Definition from DB.
     - If missing, check `ScriptProperties` (Legacy).
     - If Legacy exists: Create Definition, enrich with Topic from Classroom, Save to DB.
     - If neither: Create fresh Definition.

5. **Controller Updates**:
   - Update `InitController` / `AssignmentProcessor` to use `AssignmentDefinitionController`.
   - Implement the "Lazy Load" check: Compare Drive `modifiedTime` vs Definition `lastModified`. Only re-parse if changed.

6. **Properties Manager Retirement**:
   - Deprecate/Remove `AssignmentPropertiesManager` writes.
   - Keep reads only for the migration fallback logic.

7. **Tests**:
   - Unit tests for `AssignmentDefinition`.
   - Integration tests for `Assignment` -> `AssignmentDefinition` delegation.
   - Mocked tests for the Lazy Migration flow (Legacy Prop -> New DB).

8. **Docs**:
   - Update `DATA_SHAPES.md`.

## Dependencies

- Step 1 & 2 (Model/DB) are prerequisites.
- Step 3 (Assignment) depends on 1.
- Step 4 (Migration) depends on 1, 2, 3.

## Risks

- **Topic Changes**: If a teacher renames a Topic in Classroom, the key `${Title}_${Topic}` might mismatch.
  - _Mitigation:_ We might need a fuzzy lookup or "Alternate Topic" storage in the future. For now, assume Title+Topic is stable enough or creates a new Definition (which is acceptable, just loses history).
- **Shared State**: Changing a Definition affects all past assignments.
  - _Accepted:_ This is desired behaviour for cohort analysis.
