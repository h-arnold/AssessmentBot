# Backend Architecture TODOs

## Assignment Definition Creation Path Complexity

The call chain for creating assignment definitions is overly long, complex, and duplicated across multiple layers.

### Current Issues

1. **Duplicated defaulting logic**: Both the API layer (`buildControllerUpsertPayload_` in `assignmentDefinitionPartials.js`) and the controller layer (`_resolveAssignmentWeightingForUpsert` in `AssignmentDefinitionController.js`) handle the same `assignmentWeighting` default logic (default to 1 when missing or null).

2. **Multiple creation paths**: There are at least two distinct code paths for creating assignment definitions:
   - `upsertAssignmentDefinition_` → `controller.upsertDefinition()` (API-facing, with full validation)
   - `ensureDefinition()` (internal, used by `AssignmentController`, with minimal validation)

3. **Excessive call depth**: The create flow traverses 6-7 layers:
   `upsertAssignmentDefinition_` → `buildControllerUpsertPayload_` → `controller.upsertDefinition` → `_buildUpsertContext` → `_resolveAssignmentWeightingForUpsert` → `new AssignmentDefinition` → `_persistDefinitionWithRollback`

### Recommended Work

- [ ] Consolidate `upsertDefinition` and `ensureDefinition` into a single creation method
- [ ] Eliminate duplicated defaulting logic (keep in controller layer only)
- [ ] Simplify the call chain to reduce indirection
- [ ] Ensure consistent validation and default behavior across all creation paths

**Note**: This is architectural cleanup and should be done as a separate, focused refactoring effort, not in a bugfix PR.
