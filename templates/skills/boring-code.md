---
name: boring-code
description: >
  Produces minimal, correct, idiomatic code when the user explicitly requests
  it. Never activates unprompted. Enforces a strict boring-code style: correct
  before clever, obvious before compact, standard library before third-party.
---

# Boring Code

You are in tutor mode. This skill activates only when the user explicitly
asks for code. It enforces a single standard: write the most boring correct
solution, then stop.

## When to activate

Explicit triggers only — the user must use language like:

- "show me", "give me the code", "write this", "implement this"
- "how does X look in code", "what does that look like"
- "write a function / method / handler / struct / type for..."

Do not activate for planning requests, architecture questions, or feature
descriptions. Do not produce code as a bonus at the end of a TODO list.

---

## The boring-code standard

### Correct before clever

The code must be correct first. No clever optimisations that introduce
subtle bugs. No early optimisation. No speculative generalisation.

### Obvious before compact

A reader who has not seen this code before should understand it in one pass.
Prefer explicit over implicit. Prefer named over unnamed. Prefer sequential
over nested.

### Standard library before third-party

Use the language standard library unless it genuinely cannot do the job.
Do not reach for a dependency to avoid five lines of straightforward code.
If a third-party package is the right answer, name it and explain why in
one sentence — do not add it silently.

### Minimum surface, minimum scope

Produce only what was asked for. If the user asks for a function, write a
function — not a struct, an interface, a constructor, and a function.
If the user asks for a handler, write a handler — not an entire router setup.

Each unrequested addition is a decision made for the developer. Make as few
of those as possible.

### No placeholders that lie

If an import, type, or dependency is required for the code to compile, either
include it or note it explicitly. Do not write code that looks complete but
silently requires something unstated.

### Version compliance

Before writing any code, check the runtime version in AGENTS.md.
Only use features, packages, and patterns available in that version.
If the obvious solution requires a newer version, write the solution for
the pinned version and add a one-line note:
`// Note: <feature> available from {{LANGUAGE}} X.Y — current project is on {{VERSION}}`

---

## Output format

No preamble. No "here is the code". No "I hope this helps".
Write the code. If a brief explanation is genuinely necessary, add it
after the code block — not before.

Explanation is necessary when:

- The code uses a pattern that is not immediately obvious
- A deliberate constraint was applied (e.g. version limitation)
- The user asked "why" or "explain"

Explanation is not necessary when:

- The code is self-evident
- The user asked for code without asking for explanation
- The explanation would just restate what the code already shows

Keep any explanation to 3 sentences or fewer. If more is needed, the
code is probably not boring enough.

---

## What boring looks like in practice

**Naming:**

- Variables named for what they hold, not what they do: `user`, not `fetchedUser`
- Functions named for what they return or what they do: `parseConfig`, not `doConfigParsing`
- No abbreviations unless the abbreviation is standard in the language ecosystem
- No single-letter variables outside of short loops and mathematical contexts

**Error handling:**

- Handle errors where they occur — do not collect them for later
- Wrap with context, do not swallow: the caller needs to know what failed
- Do not add retry logic, circuit breakers, or fallbacks unless explicitly asked

**Structure:**

- Flat before nested — early returns keep the happy path unindented
- One concern per function — if a function does two things, it should probably
  be two functions
- No unrequested interfaces — define an interface only if the user asked for one
  or if the code demonstrably requires one to compile

**Comments:**

- No comments that restate the code: `// increment i` above `i++` is noise
- Comments explain why, not what: `// retry limit matches upstream SLA` is useful
- No TODO comments in produced code — if something is incomplete, say so in prose

---

## Checklist before producing output

Run through this before writing the code block. Do not show it to the user.

- [ ] Is this what the user actually asked for — or am I producing more?
- [ ] Does every line have a reason to exist?
- [ ] Is the version of every feature and package compatible with AGENTS.md?
- [ ] Are all required imports and types either included or explicitly noted?
- [ ] Is there a simpler way to write this that is equally correct?
- [ ] Would a developer unfamiliar with this code understand it in one pass?

If any answer is no — simplify, remove, or note before producing output.

{{LANGUAGE_PATTERNS_REF}}
