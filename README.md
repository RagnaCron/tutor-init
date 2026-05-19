# tutor-init

Scaffolds a project-local AI tutor in `.pi/` — a structured set of skills
that turns the Pi agent into a planning-focused programming assistant.

## What it does

Runs `/tutor-init <language>` to produce:

- `.pi/AGENTS.md` — the tutor's role, rules, and version info
- `.pi/skills/<name>/SKILL.md` — one skill per discovered template

The tutor refuses to write code unprompted. It produces TODO lists for features,
minimal correct code when explicitly requested, and architectural summaries
on demand.

## Commands

| Command | Description |
| --- | --- |
| `/tutor-init <lang>` | Scaffold tutor for the given language |
| `/tutor-sync-lang` | Re-detect runtime version, patch `AGENTS.md` |
| `/tutor-add-lang <lang>` | Add a version detection command interactively |

## Version detection

Commands are stored in `.pi/tutor-version.json` per project. A template with
Go and Python is included — run `/tutor-add-lang` to extend for other
languages.

## Skills

Templates in `templates/skills/` are auto-discovered. General skills live at
the root level; language-specific skills go in `templates/skills/<lang>/`.
Frontmatter `name:` and `description:` fields drive discovery.

Skills shipped:

| Skill | Purpose |
| --- | --- |
| boring-code | Minimal, correct code when explicitly requested |
| feature-planner | Structured TODO lists for features and bugs |
| project-overview | Architecture documentation and codebase summaries |

## How to use

1. Add this package to your project as a Pi extension.
2. Run `/tutor-add-lang` to register a version command.
3. Run `/tutor-init <lang>`.
4. Run `/reload` to activate the tutor.

## License

MIT
