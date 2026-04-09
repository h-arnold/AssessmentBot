# Low-Slop Agentic Software Delivery

## Context

I like to have my cake and eat it.

In an ideal world, I would treat an LLM as a very fast pair programmer and stay closely involved in every significant coding decision.

But I am not a professional developer. I am a Computer Science teacher with a full-time job, a pile of coursework to mark, and a product I still want to move forward.

I also want to keep developing Assessment Bot's React frontend so I can finally put the last six months of refactoring the underlying data model to practical use and get some real-world feedback from it.

That leaves me with a fairly simple choice:

- learn patience and accept slower progress
- or delegate more of the coding work to AI agents

I have chosen the second option, but with constraints.

This workflow is faster than hand coding, and one of its practical advantages is that I can leave parts of it running while I sleep. But it is much slower than simply prompting an LLM to generate code and running with whatever it gives me.

That trade-off is exactly why I call this approach low-slop rather than no-slop.

I am not claiming to have eliminated slop entirely. I am trying to reduce it systematically enough that I can delegate meaningful amounts of work without having to supervise every line like a nervous junior pair programmer.

## TL;DR

I do not try to get perfect code from an LLM in one shot.

I use a layered workflow that constrains the model at every stage:

- automated quality gates first
- structured planning with explicit templates
- a spec-first implementation loop
- specialised sub-agents with fresh context
- a stronger orchestrator model that holds scope and judgement
- dedicated review and de-sloppification passes
- documentation sync before drift sets in
- external PR review plus SonarQube as final validation layers

The result is not perfect code, but it is usually reasonably clean, well-tested, and far less sloppy than the average "AI-generated" output people complain about.

## Introduction

I have been refining a deliberately low-slop agentic workflow for software delivery.

The goal is not to get perfect code out of an LLM on the first try. That is fantasy. The goal is to build a system where mediocre model instincts get trapped by process, and good model output gets amplified.

What I want is reasonably clean, well-tested, reviewable code without having to sit there hand-holding the model line by line.

## Start With Automated Quality Gates

The workflow starts with automated quality gates.

This matters because LLMs are pattern machines, not principled engineers. If you leave them unconstrained, they will happily generate code that is plausible, verbose, slightly out of date, and just defensible enough to slow you down later.

So I put the mechanical guardrails first:

- runtime-specific ESLint configs
- SonarQube
- Husky pre-commit hooks
- coverage thresholds
- type-checking
- browser E2E tests for visible interactions

These are not optional extras. They are the first line of defence against model slop.

## Why I Choose These Quality Gates

### Unicorn

I use `unicorn` heavily because it nudges the model towards modern JavaScript and TypeScript rather than whatever happened to be over-represented in its training data.

For example, it pushes things like:

- `Number.parseInt`
- optional chaining
- modern string APIs
- newer language conventions

That matters because LLMs frequently regress towards "widely seen" code, not "best current" code.

### SonarJS

I use `sonarjs` rules because LLMs love locally reasonable but globally messy control flow. They will generate duplicated branching, awkward boolean logic, and overly complicated functions unless something pushes back.

### Security-Focused Rules

I use security-focused lint rules because models are also prone to writing code that "works" while being too trusting about inputs, object access, or error handling.

### Husky

I use Husky pre-commit hooks because formatting and autofixable hygiene issues should be handled before I even start thinking about review quality. I do not want either humans or agents spending time on problems the toolchain can eliminate automatically.

### Coverage Thresholds

I use coverage thresholds because an agent can produce a tidy-looking diff while still leaving the riskiest paths untested. Coverage is not quality, but it is a useful floor.

### Playwright

I use Playwright for visible frontend behaviour because component tests alone are not enough. LLMs are very good at producing UI code that looks fine in isolation and breaks when exercised the way a user would actually use it.

## Planning Is the Anchor

Once the gates are in place, the next step is planning.

This is the most important part of the whole workflow.

If the spec is weak, every downstream stage becomes expensive. The implementation agent guesses. The reviewer reviews against vibes. The cleanup passes remove symptoms instead of causes. You end up debating code when the real problem was that the intended behaviour was never pinned down.

So I force a proper planning loop first.

## Why I Use Templates

I use explicit templates for the spec, layout spec, and action plan.

This is important because the templates do two jobs:

- they show what must be included
- they show what must be omitted

That second point matters just as much.

A lot of AI planning artefacts fail not because they are too short, but because they are too broad. They mix behaviour, architecture, tasks, implementation notes, and open questions into one polished blob. That gives the illusion of rigour while actually making execution less reliable.

The templates keep planning focused and on track.

## The Purpose of `SPEC.md`

A good `SPEC.md` should define:

- behaviour
- constraints
- contracts
- assumptions
- settled decisions
- non-goals
- system boundaries

It should not turn into:

- an implementation diary
- a task list
- a vague wishlist
- a sequence of engineering steps

Its job is to anchor what the feature is supposed to do.

That makes it the reference point for every later stage:

- implementation
- testing
- code review
- external PR review

If the spec is clear, I can evaluate later comments against something concrete. If the spec is weak, the whole workflow becomes interpretive.

## The Purpose of the Layout Spec

I create a layout spec when the frontend workflow or UI structure materially changes.

Its job is to define:

- visible regions
- modal hierarchy
- user-facing states
- interaction surfaces
- component choices

It should stay UI-focused and should not drift into backend contracts or delivery sequencing.

This distinction matters because frontend planning often becomes muddy. If one document is trying to decide both API behaviour and modal structure at the same time, it becomes much harder to tell whether a disagreement is a product issue, a UX issue, or an implementation issue.

The layout spec keeps the UI contract explicit without polluting the feature spec.

## The Purpose of `ACTION_PLAN.md`

A good `ACTION_PLAN.md` turns the spec into a delivery plan.

Its job is to break the work into small, independently testable sections with:

- clear red/green/refactor steps
- acceptance criteria
- required checks
- sequencing that respects dependencies

It should not be used to invent product decisions that the spec failed to settle.

That is one of the easiest ways to lose control of an agentic workflow. If the action plan starts making behavioural decisions, the implementation agent is now building against an unstable target.

The action plan should sequence delivery, not redefine the feature.

## The Planning Loop

I use a planner agent to help drive out these artefacts, but the important point is that the user has to engage properly.

The user cannot stay vague and expect good output later. If the feature matters, the decisions have to be made explicitly.

That usually means producing:

- a `SPEC.md` that defines the contract
- a layout spec when the UI or workflow changes materially
- an `ACTION_PLAN.md` that sequences implementation without redefining the spec

Then I run planning review before implementation starts.

That review matters because planning errors compound. If your action plan inherits a bad assumption from the spec, you can end up executing a very disciplined process in completely the wrong direction.

## The Agentic TDD Loop

After that comes the implementation loop, and this is where the workflow becomes very agentic but still tightly controlled.

I do not just ask an implementation agent to "build the feature".

I use a TDD-oriented orchestration loop:

- testing agent writes the red tests first
- review agent checks whether those tests actually pin the behaviour I care about
- implementation agent writes the minimum code to go green
- review agent checks correctness, regressions, standards, and missing coverage
- if there are findings, implementation goes round again

This sounds slower than one-shot generation, but in practice it is much faster than pretending the first draft is good and then debugging a swamp of hidden assumptions.

## Why Sub-Agents Work Better Than One Big Prompt

A big reason this works is the way I use sub-agents.

Each sub-agent gets the benefit of fresh context, which effectively gives me a fresh pair of eyes every time.

That matters a lot. An agent that has been sitting in the same problem space for too long starts to normalise local weirdness and justify poor decisions. A fresh agent is much better at spotting gaps, mistakes, or over-complication.

That applies to:

- planning review
- test design
- code review
- de-sloppification
- documentation sync

Each one gets to look at the work without being overly attached to how it got there.

## Why the Orchestrator Uses the Strongest Judgement Model

On the other side of that setup is the orchestrator.

The orchestrator is always the larger, more capable model that keeps track of the overall implementation context. Its job is not to write every line itself. Its job is to coordinate, judge, scope, and sharpen.

That means it can do things like:

- filter out out-of-scope review comments
- tighten prompts when an implementer starts drifting
- preserve the original spec and action-plan intent across multiple rounds
- route the right task to the right sub-agent
- decide which feedback is genuinely valid and which is just noise

That division of labour is what lets me use smaller but very capable models like `5.4-mini` for implementation, test creation, and documentation tasks.

Those tasks do not need broad product judgement if they are being driven by detailed, precise, and unambiguous instructions from the orchestrating model. They mainly need discipline, accuracy, and speed.

## Why Review and De-Sloppification Use More Reasoning

By contrast, the code review agent uses a powerful frontier model with higher reasoning effort because I want it catching issues and mistakes early, before they spread.

The de-sloppification agent gets the most powerful model with the highest reasoning effort because I am effectively asking it to work against patterns in its own training data.

That is a harder job.

I am not asking it to complete a coding task. I am asking it to notice the kinds of code shapes that models are biased to produce:

- dead helpers
- duplicated logic
- unnecessary abstraction
- defensive noise
- stale compatibility branches
- plausible-but-pointless complexity

That is exactly where a stronger model with more reasoning budget is worth paying for.

## Why This Separation of Roles Matters

This is also why I like this loop more than one-shot generation.

Each agent has a narrower responsibility.

The testing agent is not trying to be clever about architecture.

The implementation agent is not deciding what "probably" matters.

The reviewer is not being asked to generate code and judge it at the same time.

The de-sloppifier is not trying to move the feature forward; it is trying to strip residue out of the result.

That separation reduces the amount of slop that slips through simply because one agent is trying to do everything at once.

I also like this loop because it creates evidence.

At any point I can ask:

- what behaviour was specified?
- which tests were meant to fail first?
- what changed to make them pass?
- what did review object to?
- which checks passed?

That is a much stronger position than "the model seemed confident".

## De-Sloppification Is a Dedicated Phase

Once the feature or refactor is functionally complete, I do not stop there.

I run a dedicated de-sloppification pass.

This is a specific phase, not a vague sentiment about code quality.

The point of de-sloppification is to target the kinds of smells LLMs produce disproportionately often:

- dead helpers
- duplicated mapping logic
- pointless abstractions with one caller
- stale compatibility branches
- defensive checks around internal code that should just fail loudly
- cargo-cult comments
- extra layers added to sound "clean" while actually obscuring the code

This phase matters because a lot of AI-generated code is not broken enough to fail tests, but is still expensive to live with.

A normal reviewer might say "looks fine".

A de-sloppification pass asks a different question:

"Why does this code exist, and does it need to?"

That catches a surprising amount.

## Documentation Sync Prevents Drift

After that I run a docs sync pass.

I do this because code drift and documentation drift happen very quickly in agentic workflows. Models are excellent at changing implementation details without naturally updating surrounding explanations, JSDoc, developer docs, or workflow notes.

So I treat documentation as a first-class sync step, not a clean-up task for later.

If behaviour changed, the docs need to change with it.

If the architecture changed, the docs need to change with it.

If the workflow changed, the agent instructions need to change with it.

## Why I Run Multiple De-Sloppification Passes

Then I run a second de-sloppification pass with a fresh agent and fresh context.

Fresh context matters here as well. An agent that has already spent a long time in the code tends to accept too much of it. A fresh pass is much better at spotting the "why is this still here?" issues.

That second pass usually finds more than I want it to.

I then use the orchestrator to address those findings and run a third de-sloppification pass. By that point the findings are usually small, but they are still worth taking seriously. Tiny rough edges accumulate.

## PR Review Is Another Validation Layer, Not the First One

Only then am I ready to open a PR.

At PR stage I add another layer: external review from Copilot and Gemini, plus SonarQube.

I do not treat those comments as gospel. I pass them back to an LLM against the original spec and ask it to evaluate them properly.

That part is important.

External review tools generate noise as well as signal. Some comments are valid. Some are generic. Some are actively worse than the current code. The spec is the anchor that lets me distinguish between "this is a real problem" and "this is just another model preferring a different shape".

SonarQube is especially useful here because it brings a different kind of pressure:

- code smells
- duplication
- security hotspots
- maintainability issues

Again, the point is not that any one tool is perfect. The point is that they fail differently.

## The Real Point of the Workflow

That is the core idea behind the whole workflow.

I do not rely on one smart model.

I rely on layered constraints, specialised agents, repeated review, fresh context, and independent sources of criticism.

That combination gets me to code that is not perfect, but is usually reasonably clean, well defended, and far less sloppy than the average AI-generated output people complain about.

## What I Have Learned

The bigger lesson for me has been this:

If you want good results from LLMs, stop thinking only about prompts.

Prompting matters, but process matters more.

Good agentic delivery is mostly about:

- forcing clarity early
- using templates to keep planning focused
- separating the purpose of spec, layout, and delivery plan
- constraining execution properly
- using fresh sub-agents as fresh pairs of eyes
- keeping orchestration and judgement with the strongest model
- making quality observable
- removing slop deliberately rather than hoping review will catch it by accident

That is what has allowed me to get consistently useful output without reading every line in babysitting mode.

Not perfect.

Not magic.

Just a better system.
