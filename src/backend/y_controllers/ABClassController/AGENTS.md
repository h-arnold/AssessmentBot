# ABClassController — Agent Notes

Applies when editing `src/backend/y_controllers/ABClassController/**`.

Read `src/backend/AGENTS.md` first. This file records only what the code does not make obvious.

## Owner map

| File                             | Owns                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `index.js`                       | Thin facade: wires the owners, delegates, and owns no persistence or validation logic |
| `ABClassAssignmentOps.js`        | Assignment run persistence orchestration and read rehydration                         |
| `ABClassAssignmentValidation.js` | Completed-run (pre-write) validation for assignment persistence                       |
| `ABClassPersistence.js`          | Prepared class/partial projections and the full-class → `abclass_partials` writes     |
| `ABClassValidation.js`           | Class-level domain checks, including `_validateClassForSave()`                        |
| `ABClassRoster.js`               | Roster refresh and field-scoped registry patching                                     |
| `ABClassMutationOps.js`          | Class upsert/update/delete orchestration                                              |
| `ABClassResponseMapper.js`       | Class read projection                                                                 |

## `ABClassAssignmentValidation` is the completion gate

- `_validateCompletedAssignmentRun(assignment)` is the only public entry. `ABClassAssignmentOps.persistAssignmentRun()` calls it before stamping `assessmentContractVersion` and before any projection or collection mutation. Do not stamp the marker or serialise first.
- The rules mirror the marker-1 read invariants (`AssignmentCurrentRestoration`, `StudentSubmissionItem`) instead of re-deriving them, so a write cannot certify a record the read path would repair. Keep that mirroring when either side changes.
- It is pure validation: no database, service or model mutation. Do not move persistence, logging or projection into it.
- Rejection messages must name the owning task plus a semantic reason. Tests assert on those reasons, so a silent wiring fault cannot satisfy a rejection row.
- This is a completion gate, not a run-start eligibility preflight. Do not add run-start checks here.
- The looser definition-write rule (a pending `IMAGE` may stay null) belongs to `AssignmentDefinitionValidation.validateSharedArtifacts()`. This gate is the stricter completed-assignment rule.

## Persistence ordering

`persistAssignmentRun()` is deliberately non-transactional. Order is: completed-run gate → class-save validation → marker stamp → four detached projections → full assignment store → class store → `abclass_partials`. A failure throws and logs the failed phase plus whether the full write committed. Do not add rollback, an unconditional `finally` save, or a second preparation path for the class projections.

Reuse `ABClassValidation._validateClassForSave()` rather than duplicating its checks; `saveClass()` enforces the same contract, and running it before the first mutation keeps a bad class from committing the full assignment.

## Related docs

- `docs/developer/backend/AssessmentFlow.md` — pipeline and persistence narrative
- `docs/developer/backend/rehydration.md` — read/rehydration boundaries
- `docs/developer/data-shapes/assignment.md`, `docs/developer/data-shapes/abclass.md` — contracts
- `docs/developer/backend/backend-testing.md` — completion-gate and persistence suite inventory
