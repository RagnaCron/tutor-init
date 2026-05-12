import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VersionSpec {
  command: string;
  pattern: RegExp;
}

// ---------------------------------------------------------------------------
// Version detection
// ---------------------------------------------------------------------------

const VERSION_SPECS: Record<string, VersionSpec> = {
  go: { command: "go version", pattern: /go(\d+\.\d+(?:\.\d+)?)/ },
  node: { command: "node --version", pattern: /v(\d+\.\d+\.\d+)/ },
  nodejs: { command: "node --version", pattern: /v(\d+\.\d+\.\d+)/ },
  python: { command: "python3 --version", pattern: /Python (\d+\.\d+\.\d+)/ },
  python3: { command: "python3 --version", pattern: /Python (\d+\.\d+\.\d+)/ },
  rust: { command: "rustc --version", pattern: /rustc (\d+\.\d+\.\d+)/ },
  deno: { command: "deno --version", pattern: /(\d+\.\d+\.\d+)/ },
  bun: { command: "bun --version", pattern: /(\d+\.\d+\.\d+)/ },
};

function detectVersion(lang: string): string | null {
  const spec = VERSION_SPECS[lang.toLowerCase()];
  if (!spec) return null;

  try {
    const output = execSync(spec.command, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    const match = output.match(spec.pattern);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function resolveVersion(version: string | null, lang: string): string {
  return version ?? `<!-- TODO: set runtime version, e.g. ${lang} 1.0.0 -->`;
}

// ---------------------------------------------------------------------------
// Token building
// ---------------------------------------------------------------------------

// Extend this set as new language-specific patterns skills are added.
// Each entry must match a template-skill-<lang>-patterns.md file in templates/.
const LANGUAGE_PATTERNS_SKILLS = new Set(["go"]);

function buildTokens(lang: string, version: string, detectedDate: string): Record<string, string> {
  const langUpper = lang.charAt(0).toUpperCase() + lang.slice(1);

  const goSkillsRows = lang === "go"
    ? "| golang-patterns     | Planning idiomatic Go structure and patterns in TODOs          |\n" +
    "| golang-testing      | Planning test coverage — table tests, benchmarks, fuzz tests   |"
    : "";

  const languagePatternsRef = LANGUAGE_PATTERNS_SKILLS.has(lang)
    ? `## Style reference\n\n` +
    `For ${langUpper}-specific style guidance, refer to the \`${lang}-patterns\` skill.\n` +
    `It is the authoritative source for naming, error handling, struct design,\n` +
    `and concurrency patterns in this project.\n\n` +
    `When boring-code and \`${lang}-patterns\` are both active, apply the patterns\n` +
    `skill\'s guidance for style decisions. Do not reproduce its code examples\n` +
    `verbatim — use them to inform what boring looks like for this language.`
    : `## Style reference\n\n` +
    `No language-specific patterns skill is configured for ${langUpper} yet.\n` +
    `Apply the boring-code standard above using the language\'s own idiomatic\n` +
    `conventions as the style anchor.`;

  return {
    LANGUAGE: lang,
    LANGUAGE_UPPER: langUpper,
    VERSION: version,
    DATE: detectedDate,
    LANGUAGE_SKILLS_TABLE: goSkillsRows,
    LANGUAGE_PATTERNS_REF: languagePatternsRef,
  };
}

// ---------------------------------------------------------------------------
// Template resolution
// ---------------------------------------------------------------------------

const TEMPLATES_DIR = path.join(__dirname, "templates");

function readTemplate(filename: string): string {
  const filepath = path.join(TEMPLATES_DIR, filename);
  if (!fs.existsSync(filepath)) {
    throw new Error(`Template not found: ${filepath}`);
  }
  return fs.readFileSync(filepath, "utf8");
}

function applyTokens(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => tokens[key] ?? `{{${key}}}`);
}

// ---------------------------------------------------------------------------
// Scaffold helpers
// ---------------------------------------------------------------------------

function getSkillSet(lang: string): Array<{ template: string; dir: string }> {
  const core = [
    { template: "template-skill-feature-planner.md", dir: "feature-planner" },
    { template: "template-skill-project-overview.md", dir: "project-overview" },
    { template: "template-skill-boring-code.md", dir: "boring-code" },
  ];

  if (lang === "go") {
    return [
      ...core,
      { template: "template-skill-go-patterns.md", dir: "go-patterns" },
      { template: "template-skill-go-testing.md", dir: "go-testing" },
    ]
  }

  return core;
}


function scaffoldTutor(
  piDir: string,
  lang: string,
  version: string | null,
  detectedDate: string
): void {
  const skillsDir = path.join(piDir, "skills");

  const versionToken = resolveVersion(version, lang);

  const tokens = buildTokens(lang, versionToken, detectedDate)

  // Write AGENTS.md
  const agentsMd = applyTokens(readTemplate("template-AGENTS.md"), tokens);
  fs.mkdirSync(piDir, { recursive: true });
  fs.writeFileSync(path.join(piDir, "AGENTS.md"), agentsMd, "utf8");

  // Write core skills
  const skills = getSkillSet(lang);

  for (const skill of skills) {
    const skillDir = path.join(skillsDir, skill.dir);
    fs.mkdirSync(skillDir, { recursive: true });
    const content = applyTokens(readTemplate(skill.template), tokens);
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), content, "utf8");
  }
}

// ---------------------------------------------------------------------------
// Patch helper for /tutor-sync-lang
// ---------------------------------------------------------------------------

const VERSION_LINE_PATTERN = /^(Version:\s*)(.+)$/m;

function patchVersion(agentsMdPath: string, version: string): boolean {
  const content = fs.readFileSync(agentsMdPath, "utf8");
  if (!VERSION_LINE_PATTERN.test(content)) {
    return false;
  }
  const patched = content.replace(VERSION_LINE_PATTERN, `$1${version}`);
  fs.writeFileSync(agentsMdPath, patched, "utf8");
  return true;
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {

  // -------------------------------------------------------------------------
  // /start-tutor <language>
  // -------------------------------------------------------------------------

  pi.registerCommand("start-tutor", {
    description: "Scaffold a project-local tutor in .pi/ — usage: /start-tutor <language>",
    handler: async (args, ctx) => {
      const lang = (args ?? "").trim().toLowerCase();

      if (!lang) {
        ctx.ui.notify("Usage: /start-tutor <language>  e.g. /start-tutor go", "warning");
        return;
      }

      const cwd = process.cwd();
      const piDir = path.join(cwd, ".pi");
      const agentsMdPath = path.join(piDir, "AGENTS.md");

      // Guard: existing setup
      if (fs.existsSync(agentsMdPath)) {
        const overwrite = await ctx.ui.confirm(
          "Tutor already initialised",
          ".pi/AGENTS.md already exists. Overwrite the entire tutor setup?"
        );
        if (!overwrite) {
          ctx.ui.notify("Aborted — existing setup unchanged.", "info");
          return;
        }
      }

      // Version detection
      let version: string | null = null;
      const detected = detectVersion(lang);

      if (detected) {
        const embed = await ctx.ui.confirm(
          "Runtime detected",
          `Detected ${lang} ${detected}. Embed this version in AGENTS.md?`
        );
        if (embed) {
          version = detected;
        }
      } else {
        ctx.ui.notify(
          `No version detection available for "${lang}". ` +
          `A placeholder will be added — fill it in manually in .pi/AGENTS.md.`,
          "info"
        );
      }

      // Scaffold
      const detectedDate = new Date().toISOString().split("T")[0];
      scaffoldTutor(piDir, lang, version, detectedDate);

      const versionNote = version
        ? `(${lang} ${version})`
        : "(version placeholder — update .pi/AGENTS.md manually)";

      ctx.ui.notify(`Tutor scaffolded ${versionNote}. Run /reload to activate.`, "info");
    },
  });

  // -------------------------------------------------------------------------
  // /tutor-sync-lang
  // -------------------------------------------------------------------------

  pi.registerCommand("tutor-sync-lang", {
    description: "Re-detect the runtime version and patch .pi/AGENTS.md",
    handler: async (args, ctx) => {
      const cwd = process.cwd();
      const agentsMdPath = path.join(cwd, ".pi", "AGENTS.md");

      if (!fs.existsSync(agentsMdPath)) {
        ctx.ui.notify(
          "No .pi/AGENTS.md found. Run /start-tutor <language> first.",
          "warning"
        );
        return;
      }

      // Read the current language from AGENTS.md
      const content = fs.readFileSync(agentsMdPath, "utf8");
      const langMatch = content.match(/^Language:\s*(\S+)/im);

      if (!langMatch) {
        ctx.ui.notify(
          "Could not find a Language: line in .pi/AGENTS.md. " +
          "Update the version manually.",
          "warning"
        );
        return;
      }

      const lang = langMatch[1].toLowerCase();
      const spec = VERSION_SPECS[lang];

      if (!spec) {
        ctx.ui.notify(
          `No version detection available for "${lang}". ` +
          `Update the version manually in .pi/AGENTS.md.`,
          "info"
        );
        return;
      }

      const detected = detectVersion(lang);

      if (!detected) {
        ctx.ui.notify(
          `Could not run \`${spec.command}\`. ` +
          `Update the version manually in .pi/AGENTS.md.`,
          "warning"
        );
        return;
      }

      const apply = await ctx.ui.confirm(
        "Runtime detected",
        `Detected ${lang} ${detected}. Patch the Version: line in .pi/AGENTS.md?`
      );

      if (!apply) {
        ctx.ui.notify("Aborted — AGENTS.md unchanged.", "info");
        return;
      }

      const patched = patchVersion(agentsMdPath, detected);

      if (!patched) {
        ctx.ui.notify(
          "Could not find a Version: line in .pi/AGENTS.md. Update it manually.",
          "warning"
        );
        return;
      }

      ctx.ui.notify(
        `AGENTS.md updated to ${lang} ${detected}. Run /reload to activate.`,
        "info"
      );
    },
  });
}
