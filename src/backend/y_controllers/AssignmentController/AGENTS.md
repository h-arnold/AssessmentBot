# AssignmentController — Agent Notes

Applies when editing `src/backend/y_controllers/AssignmentController.js`.

Read `src/backend/AGENTS.md` first. This file records only what the code does not make obvious.

## Run completion feedback

- Completion feedback is finalised only after the final successful save. Persistence failures propagate and are never reported as a completed run.
- A run whose handled student/LLM errors were persisted beside successes completes with `Assessment run completed with errors.`, reported in both progress and the toast. A healthy run keeps `Assessment run completed successfully.`.
- The failed-task count is reported as a separate progress detail (`N tasks failed.`) before the final errors sentence. Do not append the count to the final message.
- `_countFailedSubmissionItems()` counts each submission item once, no matter how many of its criteria carry `E`. It consumes the validated completed structure directly: there are no permissive defaults, so a missing submissions, items or assessments structure throws. Do not reintroduce `?? []`/`?? {}` fallbacks — they would turn a wiring fault into a false success report.
- Counting runs after persistence against the same assignment instance that was written, so it observes the persisted result rather than a re-read.

## Related docs

- `docs/developer/backend/AssessmentFlow.md` — pipeline stages and persistence handoff
- `docs/developer/backend/backend-testing.md` — completion, hydration and failed-item counting suites
- `src/backend/y_controllers/ABClassController/AGENTS.md` — persistence owner and completion gate
