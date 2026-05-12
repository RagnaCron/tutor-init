import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Version detection
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Template token resolution
// ---------------------------------------------------------------------------

function resolveVersion(version: string | null, lang: string): string {
  return version ?? `<!-- TODO: set runtime version, e.g. ${lang} 1.0.0 -->`;
}

// ---------------------------------------------------------------------------
// Template discovery
// ---------------------------------------------------------------------------

export interface SkillEntry {
  name: string;       // directory name in .pi/skills/
  description: string; // first line of frontmatter description
  templatePath: string; // relative path within templates/
}

export interface DiscoveredSkills {
  skills: SkillEntry[];
  hasPatterns: boolean;
}

/**
 * Resolve the skill directory name from a frontmatter `name:` field.
 * Falls back to the filename (strip .md, replace _/- with -).
 */
function resolveSkillDirName(dir: string, filename: string): string {
  const content = fs.readFileSync(path.join(dir, filename), "utf8");
  const match = content.match(/^---\s*\nname:\s*(.+?)\s*\n---/m);
  if (match) {
    return match[1].trim();
  }
  return filename.replace(".md", "").replace(/[_-]+/g, "-");
}

/**
 * Extract the description from frontmatter.
 * The description field may be a single line or a multi-line block (>);
 * we take the first continuation line.
 */
function extractDescription(content: string): string {
  // Single-line: description: some text
  let match = content.match(/^description:\s*(.+?)\s*$/m);
  if (match) return match[1].trim();
  // Multi-line block: description: >\n  some text...
  match = content.match(/^description:\s*>\s*\n((?:[ \t].*\n)+)/m);
  if (match) {
    return match[1]
      .split("\n")
      .map((l) => l.trimStart())
      .join(" ")
      .trim()
      .split(/\n/)[0]
      .trim();
  }
  return "";
}

/**
 * Auto-discover skill templates from the templates/skills/ directory tree.
 * - templates/skills/*.md → general skills
 * - templates/skills/<lang>/*.md → language-specific skills (only if lang matches)
 *
 * Returns an error if general and language-specific skills have the same name
 * (would create a directory collision).
 */
export function discoverSkills(templatesDir: string, lang: string): DiscoveredSkills {
  const skillsDir = path.join(templatesDir, "skills");
  const generalNames = new Set<string>();
  const entries: SkillEntry[] = [];

  if (!fs.existsSync(skillsDir)) {
    return { skills: [], hasPatterns: false };
  }

  // General skills: templates/skills/*.md
  const generalFiles = fs.readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
  for (const file of generalFiles) {
    const dirName = resolveSkillDirName(skillsDir, file);
    const content = fs.readFileSync(path.join(skillsDir, file), "utf8");
    const description = extractDescription(content);
    entries.push({
      name: dirName,
      description,
      templatePath: `skills/${file}`,
    });
    generalNames.add(dirName);
  }

  // Language-specific skills: templates/skills/<lang>/*.md
  const langDir = path.join(skillsDir, lang);
  let hasPatterns = false;
  if (fs.existsSync(langDir) && fs.statSync(langDir).isDirectory()) {
    const langFiles = fs.readdirSync(langDir).filter((f) => f.endsWith(".md"));
    for (const file of langFiles) {
      const dirName = resolveSkillDirName(langDir, file);
      if (generalNames.has(dirName)) {
        throw new Error(
          `Skill name collision: "${dirName}" exists in both general skills and ${lang}/ skills.`
        );
      }
      const content = fs.readFileSync(path.join(langDir, file), "utf8");
      const description = extractDescription(content);
      entries.push({
        name: dirName,
        description,
        templatePath: `skills/${lang}/${file}`,
      });
      // A language-specific skill is considered a "patterns" skill if its
      // name contains "pattern" or "testing" — this is the convention used
      // by the project.
      if (/pattern|testing/.test(dirName)) {
        hasPatterns = true;
      }
    }
  }

  return { skills: entries, hasPatterns };
}

// ---------------------------------------------------------------------------
// Token building
// ---------------------------------------------------------------------------

export function buildTokens(
  lang: string,
  version: string,
  detectedDate: string,
  discovered: DiscoveredSkills
): Record<string, string> {
  const langUpper = lang.charAt(0).toUpperCase() + lang.slice(1);

  // Build the skills table from discovered skills
  const skillsTableRows = discovered.skills
    .map((s) => `| ${s.name.padEnd(20)} | ${s.description} |`)
    .join("\n");

  const languagePatternsRef = discovered.hasPatterns
    ? `## Style reference\n\n` +
    `For ${langUpper}-specific style guidance, refer to the language-specific patterns\n` +
    `skill(s). They are the authoritative source for naming, error handling,\n` +
    `struct design, and other language conventions in this project.\n\n` +
    `When boring-code and the patterns skill(s) are both active, apply the\n` +
    `patterns skill\'s guidance for style decisions. Do not reproduce their\n` +
    `code examples verbatim — use them to inform what boring looks like for\n` +
    `this language.`
    : `## Style reference\n\n` +
    `No language-specific patterns skill is configured for ${langUpper} yet.\n` +
    `Apply the boring-code standard above using the language\'s own idiomatic\n` +
    `conventions as the style anchor.`;

  return {
    LANGUAGE: lang,
    LANGUAGE_UPPER: langUpper,
    VERSION: version,
    DATE: detectedDate,
    LANGUAGE_SKILLS_TABLE: skillsTableRows,
    LANGUAGE_PATTERNS_REF: languagePatternsRef,
  };
}

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

const TEMPLATES_DIR = path.join(__dirname, "..", "templates");

export function readTemplate(filename: string): string {
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
// Scaffold
// ---------------------------------------------------------------------------

export function scaffoldTutor(
  piDir: string,
  lang: string,
  version: string | null,
  detectedDate: string
): void {
  const skillsDir = path.join(piDir, "skills");
  const versionToken = resolveVersion(version, lang);

  // Discover and build tokens together
  const discovered = discoverSkills(TEMPLATES_DIR, lang);
  const tokens = buildTokens(lang, versionToken, detectedDate, discovered);

  // Write AGENTS.md
  const agentsMd = applyTokens(readTemplate("AGENTS.md"), tokens);
  fs.mkdirSync(piDir, { recursive: true });
  fs.writeFileSync(path.join(piDir, "AGENTS.md"), agentsMd, "utf8");

  // Write skills
  for (const skill of discovered.skills) {
    const skillDir = path.join(skillsDir, skill.name);
    fs.mkdirSync(skillDir, { recursive: true });
    const content = applyTokens(readTemplate(skill.templatePath), tokens);
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), content, "utf8");
  }
}

// ---------------------------------------------------------------------------
// Patch helper for /tutor-sync-lang
// ---------------------------------------------------------------------------

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
