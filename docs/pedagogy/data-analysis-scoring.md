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

When you view analysis results, each metric shows four numbers:

| Field                      | What it means                                                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Value**                  | The weighted average score (0–5), or blank/`—` if there are no applicable data points.                                                                                 |
| **Total weight**           | The sum of the influences (assignment weighting × task weighting) for all applicable submissions. This gives you a sense of how much evidence the average is based on. |
| **Applicable data points** | How many submissions actually contributed to this metric. For example, if SPaG shows 8 out of 10, it means 2 submissions were formula tasks where SPaG did not apply.  |
| **Total data points**      | The total number of submissions in this group, including those where the metric was not applicable.                                                                    |

**Example**: A student has 5 completed tasks. Their completeness score of 4.2 is based on all 5 tasks (applicable: 5 of 5). Their SPaG score of 3.8 is based on 4 of the 5 tasks (one was a formula task where SPaG was not applicable). The `totalWeight` for SPaG might be lower than for completeness because the formula task carried influence for completeness but not for SPaG.

## Planned future analyses

The current analysis shows averages per student, per task, and per class. Future updates will add:

- **Cohort analysis** — compare averages across multiple classes or year groups.
- **Trend analysis** — see how scores change over time.
- **Distribution analysis** — see the spread of scores within a class.

These will be added as separate analysis options and will not change the existing averages.
