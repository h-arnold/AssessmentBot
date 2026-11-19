# Teacher documentation workflow

When to add or update a teacher-facing tutorial or explainer, and how to produce one.
Teacher docs live in `docs/howTos/` and `docs/pedagogy/`. The implementer identifies the
affected journey, the Docs agent writes the page, and the Playwright agent captures
screenshots once the UI has settled.

## Decide whether a doc is needed

The trigger is a change to what a teacher sees, decides or does — not the size of the code
change. A one-line label change can break a workflow; a large internal refactor can be
invisible to teachers.

Ask: can a teacher name something they now want to do that they could not do reliably
before, or something they could previously do and now cannot? If not, no tutorial is
needed.

A journey needs a tutorial when all three hold:

- The teacher owns it and will repeat it.
- It needs a decision with a consequence, or an action the UI does not make self-evident.
- Getting it wrong costs time, correctness or student-data privacy.

New choices are the strongest signal. New vocabulary needed to act, a new results surface,
or a changed meaning for a number or colour also qualify.

## Choose the doc action

| Change                                             | Action                                              |
| -------------------------------------------------- | --------------------------------------------------- |
| Internal behaviour only; no visible change         | None                                                |
| Bug fix restoring already-documented behaviour     | Correct the existing wording only                   |
| Label, step or order change in an existing journey | Edit that tutorial; re-capture affected screenshots |
| New option or decision inside an existing journey  | Short section at the decision point, not a new doc  |
| New repeatable teacher goal                        | New tutorial under `docs/howTos/`                   |
| New concept too involved for a tooltip             | Extend the owning explainer, or add a short one     |

Before creating anything, find the owning doc. For scoring, weightings, averages and the
`N`/`E`/`Excluded` states, it is `docs/pedagogy/data-analysis-scoring.md`. Extend it rather
than write a rival.

## Write a tutorial

One tutorial covers one teacher goal from start to finish.

- Open with one sentence naming the outcome.
- List prerequisites before the steps.
- Use numbered steps with one action or decision per step.
- Put a screenshot immediately after the step it illustrates.
- End with a check that tells the teacher the goal succeeded, and a link to the next guide.

## Write an explainer

An explainer answers "what does this mean?" rather than "what do I do next?". Use
`docs/pedagogy/data-analysis-scoring.md` as the model. Its shape is:

1. Define the terms in plain language.
2. State the rule or model.
3. Work through one example with real numbers.
4. List the consequences and the limits.

Keep the UI summary to one line with a link to the explainer. Where a tooltip cannot carry
the full explanation, the link is where it goes.

## Capture screenshots

Give the `playwright` agent the journey, the exact UI states to capture, and the canonical
scenario or mock setup to use. Screenshot volume and selection follow the
[documentation style guide](./documentation-style-guide.md).

The Playwright agent can capture to a scratch location but cannot write under `docs/`. The
Docs agent moves the chosen PNGs into the tutorial's `images/` folder and writes the prose.
An allow rule for `docs/howTos/**/images/*.png` would let Playwright place captures
directly; it still must not write Markdown.

## File and image layout

Put each tutorial in its own folder with an `index.md` and an `images/` folder:

```
docs/howTos/run-an-assessment/
├── index.md
└── images/
    ├── run-an-assessment-classes.png
    └── run-an-assessment-assignment-select.png
```

MkDocs treats `index.md` as a folder's page and gives it a clean directory URL. Use
`index.md` rather than `README.md` for every new tutorial.

Prefix every image with the journey name. Keep images with the doc that uses them; remove
captures that no tutorial references.

## Finish the change

- Keep the journey inventory current: add a row for a new tutorial and update the
  surfaces and images for an edited one.
- Add or update the entries in `mkdocs.yml` and `docs/README.md`.
- If the UI links to the doc, use the published GitHub Pages base URL
  (`https://h-arnold.github.io/AssessmentBot/`) and update the link when the doc moves.
- Schedule this work last in the implementation round, after the code and UI have settled.
  This is the optional teacher tutorials and explainers section in the
  [action plan template](./ACTION_PLAN_TEMPLATE.md).

## Journey inventory

Each guide's images live in its own `images/` folder with the journey name as the filename
prefix.

| Teacher goal                     | Guide                                                                             | Surfaces                                                |
| -------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Prepare and distribute tasks     | [Prepare and distribute tasks](../howTos/prepare-tasks/index.md)                  | Slides editor, Alt Text dialog; Google Sheets           |
| Run an assessment                | [Run an assessment](../howTos/run-an-assessment/index.md)                         | Classes page; Assess Task dialog; definition wizard     |
| View results                     | [View results](../howTos/view-results/index.md)                                   | Class page; assignment heatmap; task previews; Heatmaps |
| Manage assignment definitions    | [Manage assignment definitions](../howTos/manage-assignment-definitions/index.md) | Assignments table; delete confirmation                  |
| Understand scores and weightings | [How Assessment Bot calculates scores](../pedagogy/data-analysis-scoring.md)      | Values on the class page and in heatmaps                |
