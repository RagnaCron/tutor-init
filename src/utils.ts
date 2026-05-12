import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

interface VersionSpec {
  command: string;
  pattern: RegExp;
}

export const VERSION_SPECS: Record<string, VersionSpec> = {
  go: { command: "go version", pattern: /go(\d+\.\d+(?:\.\d+)?)/ },
  node: { command: "node --version", pattern: /v(\d+\.\d+\.\d+)/ },
  nodejs: { command: "node --version", pattern: /v(\d+\.\d+\.\d+)/ },
  python: { command: "python3 --version", pattern: /Python (\d+\.\d+\.\d+)/ },
  python3: { command: "python3 --version", pattern: /Python (\d+\.\d+\.\d+)/ },
  rust: { command: "rustc --version", pattern: /rustc (\d+\.\d+\.\d+)/ },
  deno: { command: "deno --version", pattern: /(\d+\.\d+\.\d+)/ },
  bun: { command: "bun --version", pattern: /(\d+\.\d+\.\d+)/ },
};

export function detectVersion(lang: string): string | null {
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

const TEMPLATES_DIR = path.join(__dirname, "..", "templates");

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

export function scaffoldTutor(
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

const VERSION_LINE_PATTERN = /^(Version:\s*)(.+)$/m;

export function patchVersion(agentsMdPath: string, version: string): boolean {
  const content = fs.readFileSync(agentsMdPath, "utf8");
  if (!VERSION_LINE_PATTERN.test(content)) {
    return false;
  }
  const patched = content.replace(VERSION_LINE_PATTERN, `$1${version}`);
  fs.writeFileSync(agentsMdPath, patched, "utf8");
  return true;
}
