# Prepare and distribute tasks

For Google Slides, Assessment Bot can only assess the parts you tag. Prepare one blank
template, tag it, then make a completed copy to use as the reference.

## What you need

1. **The slide template** — the blank version you give to students.
2. **The reference slides** — a completed copy of the template. It should represent what
   you would score `5` for completeness, accuracy and SPaG (spelling, punctuation and
   grammar).
3. **The students' work** — the same template completed by your students and attached to a
   Google Classroom assignment.

Create the template first and tag it. Then make a copy and add your answers. Both copies
then carry identical tags.

## Tag Google Slides tasks

These tags are supported:

| Tag  | Used on     | Purpose                                         |
| ---- | ----------- | ----------------------------------------------- |
| `#`  | Text shapes | Marks a text element for assessment.            |
| `#`  | Tables      | Marks a table element for assessment.           |
| `~`  | Images      | Marks an image for assessment as an image task. |
| `\|` | Images      | Alternative image tag; behaves the same as `~`. |

> **Tip:** Text and table tasks are faster and usually more accurate than whole-slide image
> tasks. Tag a text or table element where you can.

### Tag text or a table

1. Open the template.
2. Select the textbox or table to assess.
3. Press `Ctrl` + `Alt` + `Y` to open the formatting options.
4. Select **Alt Text**.
5. In the **Description** box, enter the tag and a name, for example:
   - `# Task 1 - Fill in the gaps`
   - `# Task 2 - Meaning of life`

### Tag an image

1. Open the template.
2. Select the image to assess.
3. Press `Ctrl` + `Alt` + `Y` to open the formatting options.
4. Select **Alt Text**.
5. In the **Description** box, enter a `~` tag and a name, for example
   `~ Task 1 - Complete this diagram`.

You can mix text, table and image tasks in the same document.

## Google Sheets tasks

You do not need to tag Google Sheets. Assessment Bot compares the formulae in the reference
sheet with those in the template sheet. Any formula in the reference but absent from the
template becomes a task. Formulae you leave in the template as scaffolding are not
assessed. Each formula is reported as correct, incorrect or not attempted.

## Distribute the template

Attach the template to your Google Classroom assignment as normal. Students complete their
own copy.

## Next step

[Run an assessment](../run-an-assessment/index.md) once students have completed at least
part of the task.
