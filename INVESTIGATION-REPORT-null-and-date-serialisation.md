# Investigation report: Classes page and `getAssignment` failures after the ABClass metadata release

Branch: `fix/null-serialisation-and-date-normalisation`
Status: work in progress, handed over mid-investigation. Some tests are known to fail (see section 6).

This report uses British English. Personal data from the user's logs (teacher names, emails, user IDs) is deliberately
not reproduced here. The raw `frontendError` attachment is not committed because it contains such data.

## 1. Summary

Three separate defects were found. They surfaced one after another because each one hid the next.

| #   | Symptom                                                                                                                                                              | Root cause                                                                                                                                                                                                                     | Status                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Classes page shows "Classes data could not be trusted or loaded." All 27 `ClassPartial` rows fail Zod at `[n, "metadata"]` with "expected null, received undefined". | `google.script.run` drops `null` properties from objects returned by `apiHandler()`.                                                                                                                                           | Fixed and confirmed by the user in production.                                                                                                  |
| 2   | After fix 1, backend error `must be a canonical UTC datetime (metadata.classAverages.updatedAt)` from `getAllClassPartials`.                                         | JsonDbApp revives stored ISO strings as `Date` objects on read. `ABClassMetadata` only accepts strings.                                                                                                                        | Fixed and confirmed by the user in production.                                                                                                  |
| 3   | `getAssignment` fails Zod: `assignmentDefinition.referenceLastModified / templateLastModified / createdAt / updatedAt` are "received object".                        | Stored assignment documents contain `{}` for those four fields. `AssignmentSerialisation.copyJsonSnapshot` (added in #345, commit `1424b4d8`) copies a `Date` key by key, which yields `{}`, and that value is then persisted. | Code fix written, not verified in production. Already-corrupted stored data is not repaired. A conflicting design question is open (section 5). |

Defect 3 is not caused by the transport change, and the frontend does not revive `Date` objects. Zod reports "received object"
(not "received Date") and the frontend uses a plain `JSON.parse` with no reviver. The user's pasted stored document showed the
four fields as literal `{}`.

## 2. Defect 1: `null` properties dropped by `google.script.run`

### Evidence

- Frontend error: 27 `invalid_union` issues, every one at path `[n, "metadata"]`, message "expected null, received undefined".
- The backend was correct. A record with `metadata: null` run through `ABClassResponseMapper._normaliseClassPartial` and then
  `ClassPartialsResponseSchema` parsed cleanly in a throwaway Vitest test (deleted afterwards).
- The response preview in the error had a different key order from anything the mapper emits, which is consistent with Google
  re-serialising the object.
- Web search: Apps Script drops `null` properties from returned objects (Google issue tracker 209024267). I did not open the
  tracker page myself; the production fix is the real confirmation.
- `apiHandler()` returned the envelope object. The `JSON.stringify` calls in `z_apiHandler.js` only build log strings.
  The docs and the frontend harness claimed "GAS auto-stringifies return values", which is wrong.

### Fix (worked)

`src/backend/z_Api/z_apiHandler.js`: `apiHandler()` now returns `JSON.stringify(ApiDispatcher.getInstance().handle(request))`.
The frontend `deserialiseRawResponse` already parses strings, so no frontend change was needed.

### Rejected alternative

Making `metadata` `.nullish().transform(v => v ?? null)` in the frontend schema. It contradicts the documented "no frontend
legacy default" contract and would only patch one field.

## 3. Defect 2: revived `Date` objects rejected by `ABClassMetadata`

### Evidence

- Backend log: `ABClassMetadataValidationError: must be a canonical UTC datetime (metadata.classAverages.updatedAt)` thrown
  from `ABClassMetadata._validateTimestamp` via `ABClassResponseMapper._normaliseClassPartial`.
- The frontend already validates `updatedAt` as canonical before sending, so the stored value was a valid string at write time.
- `scripts/builder/vendor/jsondbapp/src/01_utils/ObjectUtils.js` (`_reviver`, `convertDateStringsToObjects`) converts any
  ISO-looking string to a `Date` on read. `Validate.isCanonicalUtcDateTime` requires `typeof value === 'string'`.
- This only appeared after fix 1, and only once the new version had written real metadata (rows were `null` before).

### Fix (worked)

Pass stored metadata through the existing `DateUtils.deepConvertDates()` before `new ABClassMetadata(...)` at the two
stored-read entry points:

- `src/backend/y_controllers/ABClassController/ABClassResponseMapper.js` (`_normaliseClassPartial`)
- `src/backend/Models/ABClass.js` (`fromJSON`)

### Tried and discarded

A new `ABClassMetadata.fromStored()` helper with its own Date conversion. The user pointed out that `DateUtils` already has
the established pattern, so this was reverted.

### Gap

`ABClass`'s constructor (`options.metadata`) and `setMetadata` still call `new ABClassMetadata(...)` directly. They take
request or in-memory input, where `Date` is not expected, so they were left alone. Worth re-checking if another stored-read path appears.

## 4. Defect 3: `{}` persisted over assignment definition timestamps

### Evidence

- Frontend `getAssignment` Zod error: `assignmentDefinition.{referenceLastModified, templateLastModified, createdAt, updatedAt}`
  "expected string, received object". Top-level `createdAt`/`updatedAt` were fine.
- The user supplied the stored `assignmentDefinition` block: those four fields were literally `{}`.
- The user confirmed `getAssignment` worked on a version deployed before the ABClassMetadata code.
- In Node, an `AssignmentDefinition` built with `Date` values serialised correctly through `toJSON()` and
  `DateUtils.deepConvertDates()`, so the transport path is not the culprit.
- Commit `1424b4d8` (#345, 4 Nov) wrapped the persisted payloads in `AssignmentSerialisation.copyJsonSnapshot(...)`:
  - `ABClassAssignmentOps.js` (full and partial assignment payloads)
  - `ABClassPersistence.js` (`_prepareFullClass`, `_prepareClassPartial`)
  - `02_AssignmentRehydration.js` (legacy persistence snapshot, unchanged)
    Before #345 these were plain `toJSON()` / `toPartialJSON()` / object spreads.
- `copyJsonSnapshot` copies objects with `Object.keys`. A `Date` has no own keys, so it becomes `{}`. JsonDbApp revives the
  stored definition timestamps as `Date`, so each save rewrote them as `{}`.
- Partial definitions embedded in class documents also carry `createdAt`/`updatedAt`, so the class-document copies are probably
  affected too. This was inferred from reading `AssignmentDefinition.toPartialJSON`, not reproduced.

### Fix 3a (written, tests pass): convert `Date` inside `copyJsonSnapshot`

`src/backend/AssignmentProcessor/Assignment/00_AssignmentSerialisation.js`: a `Date` now returns
`DateUtils.deepConvertDates(value)` (an ISO string). Covers every call site, including the legacy snapshot path.
New test: `tests/assignment/assignmentSerialisation.copyJsonSnapshot.test.js` (3 tests, passing, plus the existing
`assignmentSerialisation.test.js`).

### Fix 3b (written, breaks tests): remove the `copyJsonSnapshot` calls

At the user's request the calls in `ABClassAssignmentOps.js` and `ABClassPersistence.js` were removed, restoring the
pre-#345 form, along with the now-unused `AssignmentSerialisation` entries in their `/* global */` comments.
This **is in the working tree and committed on this branch**, but it conflicts with tested behaviour (section 5).
The user then said "neither for now", so the decision is deferred.

### Not repaired

Documents already saved with `{}` stay corrupted until rewritten from a correct source. The canonical definition in the
`assignment_definitions` collection should still hold valid timestamps, but I did not confirm whether a re-save or rehydration
repairs the embedded copy, or whether `getAssignment` can read the registry copy instead. See next steps.

## 5. Open design question: is `copyJsonSnapshot` necessary?

Initial reasoning (wrong): JsonDbApp already deep-clones on write (`DocumentOperations.js` lines 47 and 408), so the extra copy is redundant.

Contradicting evidence: after removing the calls, a partial test run showed 3 failures in
`tests/controllers/ABClassController/ABClassPersistence.unit.test.js`:

- `consumes the exact pre-full-commit prepared graphs when the input models mutate at the full-store save seam`
- `keeps the persisted graphs and the input models independent when a persisted graph node is mutated`
- `keeps the persisted class and registry payloads independent of the input assignment model`

So #345 deliberately prepares payloads before the first write and writes them later, and the models can change in between.
That detachment is a tested contract, not an accident. The remaining runs were killed (exit 143, very little free RAM), so
the full set of failing tests under 3b is unknown.

Options:

1. Restore the copies (revert 3b) and keep fix 3a. Smallest change, keeps the tested contract. Recommended.
2. Keep the removal and update the tests. Simpler code, but undoes a reviewed design.
3. Keep the copies but replace `copyJsonSnapshot` with a Date-aware deep clone built on an existing utility, if one fits.

## 6. Other changes made, and known test state

### Frontend test harness (as requested)

`src/frontend/src/test/google-script-run-harness-factory.js`: when the success handler receives an **object**, `null` object
properties are dropped (arrays keep `null` elements) before `JSON.stringify`; a **string** passes through unchanged. Live
`Date` rejection is unchanged. New spec coverage in `googleScriptRunHarness.spec.ts` (3 tests).

Fixing the specs this exposed (they handed the harness objects where the real backend hands a string):

- `src/frontend/src/test/abClass/metadataRefreshTransport.ts`
- `src/frontend/src/services/apiTransportError.details.spec.ts`

Result: full frontend Vitest run **310 files / 2979 tests passing**.

### Playwright E2E

Not verified. The E2E mocks pass objects to the same injected factory, so fixtures with `null` fields will now lose them
and may fail. I started the suite, but it exceeded the time limit and a second attempt was interrupted. This is a likely
source of failures and needs a proper run (`npm --prefix src/frontend run test:e2e`).

### Backend tests that are expected to fail

- `tests/api/apiHandler/*` (for example `abclassMetadataErrors`, `abclassMetadataReads`, `abclassMetadataWrites`,
  `dispatcher-integration`): they call `apiHandler()` and inspect the returned object, which is now a JSON string.
- `tests/synthetic-analysis/syntheticApiRoundTripBridge.test.ts` and `scripts/synthetic-test-data/apiHandlerRoundTripBridge.js`:
  the bridge passes the return of `apiHandler()` to the harness. It is now a string, which the harness passes through, but the
  bridge's documented "stringified exactly once by the harness" behaviour needs rechecking.
- The 3 `ABClassPersistence.unit.test.js` failures from section 5.
- Not confirmed: whether other backend tests fail. Run the backend project in smaller batches, for example
  `npx vitest run --project node tests/controllers/ABClassController`, because the full run was killed.

The user asked for these tests to be left until the fix was confirmed. They have not been updated.

### Documentation updated

- `docs/developer/backend/api-layer.md`: new "String serialisation contract" under "Response envelope"; corrected the
  ABClass metadata bullet (stored metadata needs `deepConvertDates`); cross-reference in the prohibited-types section.
- `docs/developer/data-shapes/transport-envelope.md`: "String transport" note.
- `docs/developer/frontend/frontend-architecture.md`, `src/frontend/AGENTS.md`: removed the incorrect "GAS auto-stringifies" claim.
- `docs/developer/frontend/frontend-testing.md`: harness description corrected.
- Not updated: `docs/developer/testing/synthetic-test-data.md` (bridge description), and nothing yet documents the
  `copyJsonSnapshot` Date behaviour or the JsonDbApp Date-revival caveat for stored reads. Neither the harness's new
  null-dropping nor Defect 2/3 are in the data-shape docs.

### Pre-commit hook state

The commit was made with `--no-verify` (as the user allowed) because the hook failed on lint:

- `src/frontend/src/test/google-script-run-harness-factory.js`: `unicorn/consistent-function-scoping` wants
  `dropNullProperties` moved to the outer scope. The factory is injected into Playwright via `Function.prototype.toString()`,
  so every helper must stay nested. Possible fixes: make the helper use a closure value as `assertNoLiveDates` does, or inline
  it as a recursive arrow inside `createRunner`. Do not disable the rule without the user's permission.
- The matching rule error in `googleScriptRunHarness.spec.ts` (`deliver`) was fixed by moving it to module scope.
- The hook also runs type checks and tests; those were not reached. Expect the known failures listed above.

## 7. What did not work or was not useful

- Full-project Vitest runs of the backend: killed after the time limit and low memory; output was lost. Use smaller
  batches and write output to a file (for example under `.opencode/scratchpad/`).
- `console.log` inside Vitest tests produced no visible output in this repo's setup; throwing an `Error` with the value was
  the workable way to inspect values.
- Reading the code alone could not explain Defect 3. It needed the stored document the user supplied.
- A first assumption that the frontend was reviving dates (user's hypothesis) was disproved: no reviver, and the Zod message says "object".

## 8. Suggested next steps

1. Decide the `copyJsonSnapshot` question (section 5). If restoring, revert the removals in `ABClassAssignmentOps.js` and
   `ABClassPersistence.js` and keep the `Date` branch in `copyJsonSnapshot`.
2. Deploy and test fix 3a on a **fresh** assessment run. Confirm the stored definition timestamps stay ISO strings.
3. Repair already-corrupted documents. First check whether `getAssignment` / rehydration can take the four definition
   timestamps from the `assignment_definitions` registry. If not, write a one-off repair that replaces `{}` values from the
   registry. Check the class documents' embedded partial definitions as well.
4. Search for other places that copy objects by key and might receive revived `Date`s (`Object.keys`/spread/`structuredClone`
   in persistence paths). JsonDbApp revival is the common source.
5. Update the backend tests for the string return (`tests/api/apiHandler/*`, synthetic bridge) with `JSON.parse` on the result,
   and add a test that `apiHandler()` returns a string that preserves `metadata: null`.
6. Run Playwright E2E and update fixtures that relied on `null` surviving the harness. Prefer feeding JSON strings from the
   mock backend, as the unit-test transports now do.
7. Update `synthetic-test-data.md` and add short docs notes for the JsonDbApp Date-revival caveat.
8. Consider a regression test that stores and re-reads an assignment document through JsonDbApp to prove no `{}` appears.
9. Run `npm run run-all-checks` once the above is done. Lint and type checks have not been run on any of these changes.
