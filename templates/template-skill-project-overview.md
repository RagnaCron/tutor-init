---
name: project-overview
description: >
  Helps the developer understand, document, and maintain a living map of the
  project. Produces or updates PROJECT.md. Activated when the user asks about
  architecture, project structure, conventions, or wants a codebase summary.
---

# Project Overview

You are in tutor mode. This skill produces documentation and architectural
summaries — not implementation code. When producing or updating PROJECT.md,
describe what exists and what decisions have been made, not what should be built.

## When to activate

- User asks "how is this project structured" or "walk me through the codebase"
- User asks about architecture, layers, or component responsibilities
- User wants to create or update a PROJECT.md
- User asks about conventions, patterns, or decisions already in the codebase
- User is onboarding to an existing project and needs orientation

Do not activate for feature planning — that goes to feature-planner.

---

## Investigation process

Before producing any output, read the codebase. Work through these steps.
Do not show this process to the user.

1. **Find the entry points** — where does execution start? `main`, `cmd/`,
   `index`, `app`, or equivalent for the language. This anchors everything else.

2. **Trace the layers** — follow the call chain from the entry point inward.
   Identify the major layers (transport, business logic, data access, external
   services). Name them as they are named in the code, not as you would name them.

3. **Identify the boundaries** — where does the project hand off to something
   external? HTTP clients, database connections, file I/O, message queues.
   Each is a seam and a risk surface.

4. **Read the module or package structure** — what are the top-level packages
   or modules? What does each own? Look for patterns: is it layered, feature-
   sliced, or something else?

5. **Spot the conventions** — how are errors handled? How is configuration
   loaded? How are tests organised? What naming patterns are consistent?
   Do not invent conventions — only record what is already there.

6. **Note the gaps** — missing documentation, unclear ownership, components
   that do not fit the dominant pattern. These are Notes, not TODOs — the
   developer decides whether to act on them.

---

## Output: PROJECT.md

When asked to create or update PROJECT.md, use this structure.
Omit sections that genuinely do not apply — do not write placeholder text
for things that do not exist yet.

```markdown
# <Project name>

> <One or two sentences: what this project does and who it serves.>

## Runtime

Language: {{LANGUAGE}}
Version:  {{VERSION}}

## Architecture

<Describe the dominant architectural pattern in 2–4 sentences. Name the layers
as they appear in the code. Avoid generic terms like "MVC" unless the code
actually uses that vocabulary.>

## Structure

<Top-level directory or package map. One line per entry.>

\`\`\`
<dir or package>/   — <what it owns>
<dir or package>/   — <what it owns>
\`\`\`

## Entry points

| Entry point  | Purpose                        |
|--------------|--------------------------------|
| <file/cmd>   | <what starts here and why>     |

## Key components

<One subsection per major component. Keep each to 3–5 sentences.>

### <Component name>

<What it does. What it owns. What it does not own. What it depends on.>

## External boundaries

| Boundary         | Direction    | Purpose                          |
|------------------|--------------|----------------------------------|
| <name>           | outbound     | <what the project calls out to>  |
| <name>           | inbound      | <what calls into the project>    |

## Conventions

| Concern          | Convention                                         |
|------------------|----------------------------------------------------|
| Error handling   | <how errors are wrapped, returned, logged>         |
| Configuration    | <how config is loaded and where it lives>          |
| Testing          | <how tests are organised and what they cover>      |
| Naming           | <any consistent naming patterns worth knowing>     |

## Decisions

<Short log of significant architectural decisions already made. Not a wishlist —
only decisions that are reflected in the current code.>

- **<Decision>** — <why it was made, and what it rules out>

## Notes

<Observations that do not fit elsewhere. Missing documentation, unclear
ownership, components that deviate from the dominant pattern.>
```

---

## Output: codebase summary (no file)

When the user asks for an orientation without wanting a file, produce a
conversational summary using the same investigation process. Structure it as:

1. What the project does (one sentence)
2. How it is organised (layers and packages, 2–4 sentences)
3. Where execution starts
4. The two or three things worth knowing before reading any code

Keep it under 200 words. If the user wants more depth on a specific area,
they will ask.

---

## Maintaining PROJECT.md

When the user asks to update an existing PROJECT.md:

- Read the existing file first
- Identify what has changed since it was written
- Update only the sections that are stale — do not rewrite sections that
  are still accurate
- Add a `Last updated: <date>` line under the project name if one does not
  already exist, or update it
- Note what changed at the bottom under a `## Changelog` section if the
  update is substantial

Never remove information that is still accurate. Never add information about
planned changes — PROJECT.md records what exists, not what is intended.

---

## What good looks like

**User:** Can you give me a quick orientation to this codebase?

**Good response:**

This is an HTTP API server that manages user accounts and billing for a SaaS
product.

It is organised in three layers: handlers in `internal/handler/` receive HTTP
requests and parse inputs; services in `internal/service/` contain business
logic and orchestrate operations; repositories in `internal/repository/` handle
all database access. Nothing crosses layers in the wrong direction.

Execution starts in `cmd/server/main.go`, which wires dependencies and starts
the HTTP server.

Three things worth knowing before reading the code: errors are always wrapped
with `fmt.Errorf("context: %w", err)` — follow the chain and you find the
root cause. Configuration is loaded once at startup from environment variables
via `internal/config/`. Tests live next to the code they test and use
table-driven patterns throughout.

---

**User:** Create a PROJECT.md for this project.

**Good response:** *(produces PROJECT.md using the template above, populated
from what was actually found in the codebase — no placeholder sections, no
invented content)*
