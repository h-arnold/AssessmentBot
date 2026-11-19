---
description: Audit documentation in slices, synthesise a deduplicated issues document, delegate fixes by the same split, and review until clean
---

Audit the documentation in `docs/` and the repository-root `README.md`, decide what should
change, delegate the fixes, and review them until no findings remain. Work in three phases:
audit, remediate, review.

Audit and review subagents are read-only. Fix subagents may edit only the files listed in their
batch brief. The existing `.opencode/scratchpad/docs-audit/report.md` holds the completed audit
that the rule backlog cites; treat it as a protected artefact and never overwrite it.

## Delegation rules

- Run slices in batches of three or four concurrent subagents. Start a fresh session for each;
  resume a session only when it returned an error or an empty response.
- Do not attach agent definition files or `AGENTS.md` files to any brief; those are injected
  automatically.
- Every subagent writes its output to its own scratchpad file and returns only that path, so
  full results survive if the orchestrating agent is compacted.

## 1. Prepare

1. Read @docs/developer/documentation-style-guide.md. It is compulsory reading and the
   source of truth for audience, writing style, ownership, ADR rules and audit exclusions.
2. Apply the exclusions from the style guide: `docs/releaseNotes/**` content, `docs/plans/**`,
   and `docs/developer/frontend/ant-design-docs-cache/**`. The style guide itself is also out
   of audit scope, as its source of truth. Release-note nav and index coverage stays in scope.
3. Enumerate the remaining Markdown files under `docs/` plus the root `README.md`, and write
   an exact per-slice manifest to `.opencode/scratchpad/docs-audit/slices/manifest.md`. Every
   in-scope file must belong to exactly one slice. Every phase uses this manifest verbatim;
   do not derive slice membership again. Keep each slice at or below roughly 3,000 lines. If a
   slice must be split, give each part a new name derived from its content, record both parts
   and their findings filenames in the manifest, and use those names in every phase.
4. Create `.opencode/scratchpad/docs-audit/slices/`, `.../fixes/` and `.../reviews/` if they
   do not exist. Clear stale files from a previous run only after checking that no in-flight
   slice needs them.

## 2. Slice plan

The table describes each slice; the manifest written in Prepare is the exact file list. The
root `README.md` is audited for teacher-facing style and terminology.

| Slice               | Content                                                                                                                                                       | Approx. lines | Agent               | Findings file            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------- | ------------------------ |
| Teacher-facing      | `docs/setup/`, `docs/howTos/`, `docs/pedagogy/`, root `README.md`                                                                                             | ~930          | `docs`              | `teacher-facing.md`      |
| Frontend A          | architecture, data-analysis, loading/width, spacing, logging, modal, shell, page header, metric docs                                                          | ~2.1k         | `docs`              | `frontend-a.md`          |
| Frontend B          | frontend-testing, playwright, react-query, shared helpers                                                                                                     | ~2.4k         | `docs`              | `frontend-b.md`          |
| Backend             | nine docs under `docs/developer/backend/`                                                                                                                     | 2.7k          | `docs`              | `backend.md`             |
| Data shapes A       | `abclass.md`, `frontend-data-analysis-response.md`                                                                                                            | 2.9k          | `data-shapes-agent` | `data-shapes-a.md`       |
| Data shapes B       | assignment-definition, student-submission, assessment, assignment                                                                                             | 2.5k          | `data-shapes-agent` | `data-shapes-b.md`       |
| Data shapes C       | `INDEX.md`, auth-cache, auth-users, backend-config, base-task-artifact, google-classrooms, reference-data, request-store, transport-envelope, trigger-context | 2.7k          | `data-shapes-agent` | `data-shapes-c.md`       |
| Security            | six docs under `docs/developer/security/`                                                                                                                     | 1.3k          | `docs`              | `security.md`            |
| Builder and testing | three docs under `docs/developer/builder/`, `docs/developer/testing/synthetic-test-data.md`                                                                   | 1.5k          | `docs`              | `builder-and-testing.md` |
| Templates and specs | `ACTION_PLAN_TEMPLATE.md`, `LAYOUT_SPEC_TEMPLATE.md`, `SPEC_TEMPLATE.md`, `regression-cli-spec.md`, `known-flaky-tests.md`                                    | 1.4k          | `docs`              | `templates-and-specs.md` |
| Index and ADR       | `docs/README.md`, `docs/architecture/YearGroupKey.md`                                                                                                         | 220           | `docs`              | `index-and-adr.md`       |

## 3. Delegate slice audits

Each brief must state:

1. **Scope**: the exact file list from the manifest for that slice, and nothing else.
2. **Mandatory reading**: `@docs/developer/documentation-style-guide.md` followed by a space.
   Include this even for `data-shapes-agent`, which does not load the docs agent instructions.
3. **Audience row**: name which row of the style guide's audience table applies to the slice.
4. **Read-only**: do not edit or create any tracked source file. The only permitted write is
   the subagent's own findings file in the scratchpad. State this explicitly for
   `data-shapes-agent`, whose definition grants `edit` on `*.md`, and explicitly authorise
   its single scratchpad output file as an override of its general write-location guardrail.
5. **Task**: check both accuracy against the codebase (paths, symbols, config keys, versions,
   line anchors, shipped-feature status) and compliance with the style guide (delivery
   narrative, duplication, ownership, density, formatting, terminology).
6. **Method**: locate candidate passages with search first, then read the surrounding
   section. Do not try to read every file in full; for files over 1,000 lines, read only the
   relevant sections.
7. **Evidence**: for every staleness claim, state how it was verified — glob result, path
   lookup, `git cat-file`, config or source file. Do not report a guessed fact. Use "Needs
   verification" only for findings observed in the docs whose resolution needs an owner
   decision or confirmation outside the repository.
8. **Output**: report every finding; do not cap the count. For each give an ID (`TA-01`,
   `FB-01`, and so on), `file:line`, style-guide category, severity (High/Medium/Low), the
   problem with a short quote, and a concrete suggested fix. Separate "High confidence"
   from "Needs verification". Rank by what would change a reader's action. Add a short list
   of categories that came back clean.
9. **Findings file**: write findings incrementally to
   `.opencode/scratchpad/docs-audit/slices/<slice-name>.md`, using the filename recorded in
   the manifest for that slice. Write each finding as soon as it is confirmed, so a cancelled
   agent leaves usable partial findings. Return only that path to the orchestrating agent.

If a subagent starts repeatedly filling its context and being compacted, cancel it and split
that slice into two smaller briefs rather than waiting for it to finish. Read any partial
findings file it left behind before re-running the slice.

## 4. Central checks

Once the audit batches are dispatched, run these yourself; do not delegate them:

- `mkdocs.yml` nav against files on disk and against the `docs/README.md` index, including
  release-note nav coverage and duplicate nav labels. Check that the links in
  `docs/releaseNotes/RELEASES.md` cover every release-note file on disk; this is a link
  inventory, not a content review.
- Duplication and contradictions that span slices, especially the same rule stated in two
  canonical docs and agent instructions that disagree with a doc.
- Terminology: use "Assessment Bot" (two words) consistently.
- ADR treatment: narrative about why a decision was made is allowed; implementation status,
  before/after tables, option letters and generation metadata are not.

Record these as findings with origin `central` and IDs prefixed `C-`, and assign them to the
owning batch. A central decision may add an explicitly named file outside `docs/`, such as
`mkdocs.yml`, to that batch's allowed list; the fix brief must then name it verbatim.

## 5. Synthesise the issues document

Read every returned findings file in full. Write one comprehensive document to
`.opencode/scratchpad/docs-audit/issues.md`.

- Deduplicate: merge findings that describe the same defect. Keep every affected location and
  the strongest evidence; full quoted evidence stays in the slice findings files, linked by ID.
- For each issue record: ID, severity, location(s), finding, decision, fix batch, status.
- Decide every structural or ownership question here — for example whether content belongs in
  frontend or testing docs, which doc owns a rule, whether a section is deleted, merged or
  relocated. Fix agents follow the decision; they do not re-decide it.
- Where subagents disagree, choose one account, record the rationale, and apply it consistently.
- Any decision that creates or removes a doc, or materially changes its purpose, must name
  `docs.md` in that batch's allowed files, and `code-reviewer.md` as well when the file is a
  data-shape contract. For `data-shapes-agent`, writes to those two files are explicitly
  authorised as an override of its general write-location guardrail. This satisfies the agents'
  own update obligations without conflicting with the fix brief.
- An issue may be marked **Accepted** with a recorded rationale. Accepted issues are not fix
  work and are not re-raised by reviewers.
- Do not fix anything in this phase. The issues document is the complete plan.

## 6. Delegate fixes

Reuse the manifest and the same agent types. Run batches of three or four fresh sessions.

Each fix brief must state:

1. The verbatim issue rows assigned to that batch and their decisions.
2. Compulsory reading: `@docs/developer/documentation-style-guide.md` followed by a space.
3. The exact files the agent may edit, taken from the manifest plus any file explicitly added
   by a central decision or by the doc/agent-update obligation. No other file may be touched.
4. Apply the recorded decision only. Do not expand scope, restructure unrelated sections or
   invent new rules. If a decision cannot be applied, report that instead of improvising.
5. Do not commit, and do not change code or JSDoc. Agent instruction files may be edited only
   when named by the issue decision or required by the doc/agent-update obligation.
6. Write a fix log incrementally to
   `.opencode/scratchpad/docs-audit/fixes/<slice>-cycle<N>.md`, starting at cycle 1 and using a
   new file for each later cycle. List each issue ID, the change made and the files touched.
   Return only that path.
7. For `data-shapes-agent` batches, state explicitly in the brief that writes to the scratchpad
   fix log and to `docs.md` or `code-reviewer.md` when required by the update obligation are
   authorised overrides of its write-location guardrail.

Update the status of every issue in `issues.md` after each batch, recording the fix log path.

If a fix agent is cancelled, run `git status` and `git diff` on that batch's files before
re-delegating, and read any partial fix log, so work is neither double-applied nor skipped.

## 7. Review loop

After all fix batches land, delegate a fresh review of every slice that had fixes using the
same manifest and agent types. This first cycle is the full pass. Later cycles review only the
slices changed in that cycle. Each cycle uses a new filename, so previous reviews are preserved.

Each review brief must state:

1. The exact slice files and the verbatim issue rows with their decisions assigned to that
   batch.
2. Compulsory reading: `@docs/developer/documentation-style-guide.md` followed by a space,
   and `@.opencode/scratchpad/docs-audit/issues.md` followed by a space.
3. Read-only: do not edit or create any tracked source file. The only permitted write is the
   review file in the scratchpad. State explicitly for `data-shapes-agent` that its single
   scratchpad output file is authorised as an override of its general write-location guardrail.
4. Report every finding; do not cap the count, using the same format and IDs convention as the
   audit phase. Apply the Task, Method and Evidence rules in §3.5–7 to review findings too:
   re-verify accuracy against the codebase and state how staleness claims were checked.

Write the review file incrementally to
`.opencode/scratchpad/docs-audit/reviews/<slice>-cycle<N>.md` and return only that path. Read
every review file in full. If a review agent is cancelled, read any partial review file and run
`git status` and `git diff` on that batch's files before re-delegating.

- Reviewers do not see the fix logs. They check the resulting tree against the style guide and
  against the issues document's decisions, and do not re-raise issues marked Accepted.
- Update issue statuses in `issues.md` after each review. An issue is resolved only when a
  reviewer confirms the fix in that cycle. A recurring issue keeps its original ID and is
  reopened.
- A clean review — no outstanding findings across the slices reviewed in that cycle — is a
  success exit. Stop the loop and go to §8.
- Otherwise, a cycle makes progress when no previously open issue ID recurs and at least one
  issue is confirmed resolved by a reviewer. If a cycle makes no progress, stop and report the
  blocker. This stop rule takes precedence over re-delegation.
- Unless a clean review or the progress check above stops the loop, a review finding at any
  severity is added to `issues.md` with a new ID (recurrences keep the original ID), assigned
  to the owning batch, fixed and reviewed again.

## 8. Report

Write the final report to `.opencode/scratchpad/docs-audit/reconcile-report.md`. Do not write
to `report.md`. Include the original findings, the decisions made in synthesis, the fixes
applied, each review outcome, and every issue marked Accepted with its rationale. Return a
short summary in chat that leads with the number of issues resolved and the path to the report.
