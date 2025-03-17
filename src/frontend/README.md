# Google Slides Assessor

[*See the docs for more details*](/docs/setup/README.md)

This script handles the bulk of the client side grunt work. It:

 - collates the student submissions for a given Google Classroom assignment
 - collects and uses the reference and empty slide Ids for comparison with the student work
 - parses all the data from said slides, converting them into distinct tasks based on how you tagged them in the reference and student slides.
 - sends all that data off to the Langflow backend (while keeping any PII firmly within your work Google Account)
 - creates an analysis sheet for you to see what the results of the assessment was.
 - creates and or updates an overview sheet which averages out all the Completeness, Accuracy and SPaG scores from all their work.

