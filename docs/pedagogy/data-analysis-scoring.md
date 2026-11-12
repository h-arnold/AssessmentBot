# How Assessment Bot Calculates Scores

This page explains how Assessment Bot turns your students' assessment data into the scores and averages you see in the analysis view. It is written for teachers, not developers.

## The four metrics

For each student, task, and class, Assessment Bot calculates four scores:

| Metric           | What it measures                                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Completeness** | Did the student attempt all required parts? A high score means most or all tasks were addressed.                                                                |
| **Accuracy**     | Is the work correct? A high score means few errors.                                                                                                             |
| **SPaG**         | Spelling, punctuation, and grammar. For tasks that do not involve writing (such as spreadsheet formulae), this may be marked as **not applicable** (see below). |
| **Overall**      | A combined score that brings the other three together into a single number.                                                                                     |

Each metric is reported on a 0–5 scale (0 = fail, 5 = excellent). The 'Overall' score is also on a 0–5 scale so you can compare it directly with the others.

## How weighting works

Not every piece of work contributes equally to the averages. Two kinds of weighting control influence:

### 1. Criterion weightings (completeness vs accuracy vs SPaG)

By default, the Overall score weighs the three criteria as:

- **Completeness: 40%**
- **Accuracy: 40%**
- **SPaG: 20%**

This 40/40/20 split means completeness and accuracy each count twice as much as SPaG towards the Overall. You can change these proportions when you run an analysis — for example, you could make accuracy worth 60% and share the remaining 40% between completeness and SPaG. The percentages must always add up to 100%.

### 2. Assignment and task weightings

Each **assignment** has an assignment weighting (default: 1). Each **task within an assignment** has a task weighting (default: 1). The combined influence of a single student response on the averages is:

> **influence = assignment weighting × task weighting**

So a major assignment with weighting 2 counts twice as much as a routine assignment with weighting 1. Similarly, a long task within an assignment might have weighting 3, making it three times more influential than a short task with weighting 1.

### Work with zero weighting

You can give a task or assignment a weighting of zero. This keeps its assessed
scores visible without letting them influence an average. When you use zero
weighting:

- a numeric score of 0–5 is still shown exactly as assessed;
- a genuine **N** still means the work was not attempted or was not applicable;
  it is never created merely because a weighting is zero;
- zero-weight work adds nothing to an average, so it does not change the result;
  and
- when every piece of work behind an average has zero weighting, the result
  shows **Excluded** instead of a number, **N**, or **E**.

**N**, **E**, and **Excluded** are three different things:

- **N** means the student did not attempt the work, or it was not applicable.
- **E** means the analyser could not produce a usable score (for example,
  submissions exist but no assessments were performed).
- **Excluded** means work was assessed, but none of it contributed to the
  average — because its weighting was zero, or, in Baseline tasks mode, because
  the work fell outside the baseline task set (see Averages basis below). It
  only appears when at least one observation was recorded, so a genuine data
  gap is never labelled this way.

In the task heatmap, a zero-weight task heading is marked down its left and
right edges and explains on hover or keyboard focus that “Zero weighting —
scores are shown but do not contribute to averages.” The scores themselves keep
their usual colours. **Excluded** appears wherever an average is shown — on the
Class page's Recent Assignment cards and Student Averages table — not in the
task-level heatmap cells. This helps distinguish intentional practice,
diagnostic, or display-only work from missing assessment data.

## How the Overall score is calculated

For each student response, Assessment Bot first checks which criteria are available:

- If the student's work includes all three criteria (completeness, accuracy, and SPaG), the Overall is the weighted average of all three.
- If SPaG is "not applicable" (marked as **N** — see below), the Overall is calculated from completeness and accuracy only, with their weightings adjusted proportionally.

The formula for one student response is:

> **Overall = (completeness weighting × completeness score + accuracy weighting × accuracy score + SPaG weighting × SPaG score) ÷ (sum of applicable weightings)**

Because the weightings always add up to 100% when all three criteria are present, the Overall is on the same 0–5 scale as the individual criteria.

### Worked example: a student with a formulae task

Imagine a student has the following scores on a spreadsheet task where SPaG is marked as **N** (not applicable — the task involves formulae, not writing):

| Criterion    | Score | Weighting                      |
| ------------ | ----- | ------------------------------ |
| Completeness | 4     | 40% (0.4)                      |
| Accuracy     | 3     | 40% (0.4)                      |
| SPaG         | N     | 20% (0.2 — but not applicable) |

The Overall calculation:

1. The SPaG score is **N**, so it is excluded. The remaining criteria are completeness (weighting 0.4) and accuracy (weighting 0.4).
2. Their combined weighting is 0.4 + 0.4 = 0.8.
3. The Overall is: **(0.4 × 4 + 0.4 × 3) ÷ 0.8 = (1.6 + 1.2) ÷ 0.8 = 2.8 ÷ 0.8 = 3.5**

So the Overall score is 3.5 out of 5. This is higher than a simple average of 4 and 3 (which would be 3.5 anyway in this case because the two available weightings are equal). If the weightings were unequal, the weighted result would tilt towards the higher-weighted criterion.

## What happens when SPaG is not applicable (N)

Some tasks — particularly spreadsheet or formula-based tasks — do not involve writing, so SPaG does not apply. In this case:

- The SPaG score is recorded as **N** (not applicable).
- The overall calculation **renormalises** by dropping SPaG and dividing only by the sum of the remaining criteria weightings (see the worked example above).
- The SPaG metric for the student will show fewer applicable data points than total data points. For example, if a student has 5 pieces of work but 2 are formula tasks, the SPaG metric might show `applicableDataPoints: 3` and `totalDataPoints: 5`. This is not a problem — it simply means SPaG was not relevant for 2 of the 5 submissions.

## Understanding the numbers in the results table

When you view analysis results, each metric shows four rows of summary data:

| Field                      | What it means                                                                                                                                                                                                                                                                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Value**                  | The weighted average score (0–5) with the band colour (red, amber, or green); or **N** (grey) when the student did not attempt the work; or **E** (dark red) when the analyser could not compute a usable value; or **Excluded** (neutral) when work was assessed but none of it counted towards the average. The colour is the visual signal of the band. |
| **Total weight**           | The sum of the influences (assignment weighting × task weighting) for all applicable submissions. This gives you a sense of how much evidence the average is based on.                                                                                                                                                                                     |
| **Applicable data points** | How many submissions actually contributed to this metric. For example, if SPaG shows 8 out of 10, it means 2 submissions were formula tasks where SPaG did not apply.                                                                                                                                                                                      |
| **Total data points**      | The total number of submissions in this group, including those where the metric was not applicable.                                                                                                                                                                                                                                                        |

The **Value** row can now show four kinds of result: a number for computed scores, **N** for work the student did not attempt, **E** for cases where the analyser could not produce a usable score (for example, submissions exist but no assessments were performed), or **Excluded** when work was assessed but none of it contributed to the average (because its weighting was zero, or, in Baseline tasks mode, because the work fell outside the baseline task set). The band colour (red, amber, green, grey, neutral, or dark red) is the visual signal that tells you at a glance which state applies. **N** is always a deliberate signal that the student did not attempt the work — it is not the same as a data problem. **E** means submissions exist but the analyser could not compute a usable value for that metric. **Excluded** is distinct from both: the work exists and may have a score, but the average had nothing to count.

Note: when the analyser encounters the **E** state, `totalDataPoints` may exceed `applicableDataPoints` even when no **N** is recorded. This simply means submissions exist but none of them had usable assessment data for that metric — it is not a sign of missing data.

It is important to know that a single task showing **E** does **not** ruin the whole average for a student or for the class. If one task cannot be scored (and shows **E**), the system simply leaves that task out of the average and works out the result from the remaining tasks that have usable scores. This means a few missing scores in a handful of tasks will not wipe out the overall picture — the remaining data still counts.

**Example**: A student has 5 completed tasks. Their completeness value of 4.2 is based on all 5 tasks (applicable: 5 of 5). Their SPaG value of 3.8 is based on 4 of the 5 tasks (one was a formula task where SPaG was not applicable). The `totalWeight` for SPaG might be lower than for completeness because the formula task carried influence for completeness but not for SPaG.

## Averages basis: all tasks or baseline tasks

The Class page has an **Averages basis** control with two options: **All tasks** (the default) and **Baseline tasks**. It changes which tasks feed the Class page's averages — the Recent Assignment cards and the Student Averages table. It never changes an individual task score.

### Why a baseline helps

If a class skipped a lesson or has not yet reached part of an assignment, those unattempted tasks pull the class's averages down under **All tasks**. **Baseline tasks** instead measures everyone against the work that was actually taught and attempted, so classes at different stages can be compared more fairly.

### What changes in Baseline tasks mode

- The Recent Assignment cards and the Student Averages table are calculated over the **baseline task set** — the tasks that all of the most-engaged students attempted — rather than every task.
- A student whose work all falls outside that set shows **Excluded** for their averages: their work is displayed, but none of it fed these averages. In this mode **Excluded** can mean either zero weighting or work outside the baseline set, and the accompanying description names both possible causes.
- In the embedded heatmap view, task columns outside the baseline keep their scores but carry a **†** marker, and a caption above the table explains it.

### What stays the same

- Every individual task score and every heatmap cell is identical in both modes.
- The task summary cards (the descriptive evidence about each task) are unchanged.
- The Heatmaps page always uses all tasks and has no baseline option.

### How the baseline set is chosen

1. The **baseline pool** is the class's most-engaged students: the top ten per cent by number of tasks attempted, and always at least 2 students. Only students who attempted at least one task can be in the pool.
2. The **baseline task set** is the work every student in that pool attempted — a task counts only if all of them did it.

For example, in a class of 24, the pool is the 3 students with the most attempts, and the baseline set is the tasks all 3 of them attempted.

### When the option is unavailable

The control is disabled, with the reason available on hover and to screen readers, when either:

- the class has fewer than 3 students; or
- fewer than 2 students attempted any of the work in the selected assignments.

If the most-engaged students attempted no task in common, there is no baseline to average over: the analysis shows an error, and the control stays available so you can switch back to **All tasks**.

### Limits to keep in mind

- The choice belongs to the Class page alone and is not remembered: leaving the class or reloading the page returns it to **All tasks**.
- It never rescales or re-marks anyone's work. A task outside the baseline keeps its scores; these averages simply do not count it.
- Each class works out its own baseline from its own students.

## Planned future analyses

The current analysis shows averages per student, per task, and per class. Future updates will add:

- **Cohort analysis** — compare averages across multiple classes or year groups.
- **Trend analysis** — see how scores change over time.
- **Distribution analysis** — see the spread of scores within a class.

These will be added as separate analysis options and will not change the existing averages.

The Class page (the per-class overview surface) is the first place the four states (computed score, **N** for not attempted, **E** for error, and **Excluded** for aggregates whose observed work did not contribute) appear. Cohort, trend, and distribution analyses will reuse the same vocabulary when they are built.
