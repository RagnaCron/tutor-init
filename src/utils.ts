import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Semver extraction — shared by all language version commands
// ---------------------------------------------------------------------------

const SEMVER = /(\d+\.\d+(?:\.\d+)?)/;

// ---------------------------------------------------------------------------
// Project-level version config: .pi/tutor-version.json
// ---------------------------------------------------------------------------

interface VersionConfig {
  versionCommands: Record<string, string>;
}

const CONFIG_FILENAME = "tutor-version.json";

/** Load project version config. Returns null when the file is missing. */
export function loadVersionConfig(cwd: string): VersionConfig | null {
  const configPath = path.join(cwd, ".pi", CONFIG_FILENAME);
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return JSON.parse(raw) as VersionConfig;
  } catch {
    return null;
  }
}

/** Save (or overwrite) the project version config. */
export function saveVersionConfig(cwd: string, config: VersionConfig): void {
  const configPath = path.join(cwd, ".pi", CONFIG_FILENAME);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

/** Add or overwrite a version command for the given language. */
export function addVersionCommand(cwd: string, lang: string, command: string): void {
  const config = loadVersionConfig(cwd) ?? { versionCommands: {} };
  config.versionCommands[lang.toLowerCase()] = command;
  saveVersionConfig(cwd, config);
}

/**
 * Detect the runtime version for a language.
 * Reads the command from .pi/tutor-version.json, falls back to a version
 * placeholder when the command is not configured or fails.
 */
export function detectVersion(cwd: string, lang: string): string | null {
  const config = loadVersionConfig(cwd);
  if (!config) return null;

  const cmd = config.versionCommands[lang.toLowerCase()];
  if (!cmd) return null;

  try {
    const output = execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    const match = output.match(SEMVER);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

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
  hasLangSpecific: boolean; // true if templates/skills/<lang>/ exists and is non-empty
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
    return { skills: [], hasLangSpecific: false };
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
  let hasLangSpecific = false;
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
    }
    if (langFiles.length > 0) {
      hasLangSpecific = true;
    }
  }

  return { skills: entries, hasLangSpecific };
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

  const langSpecificSkills = discovered.skills.filter(
    (s) => s.templatePath.startsWith(`skills/${lang}/`)
  );
  const langSpecificNames = langSpecificSkills.map((s) => `- ${s.name}`).join("\n");

  const languagePatternsRef = discovered.hasLangSpecific
    ? `## Style reference\n\n` +
    `For ${langUpper}-specific style guidance, refer to the following\n` +
    `language-specific skill(s):\n\n` +
    `${langSpecificNames}\n\n` +
    `They are the authoritative source for naming, error handling, struct\n` +
    `design, and other language conventions in this project.\n\n` +
    `When boring-code and these skills are both active, apply their guidance\n` +
    `for style decisions. Do not reproduce their code examples verbatim —\n` +
    `use them to inform what boring looks like for this language.`
    : `## Style reference\n\n` +
    `No language-specific skill is configured for ${langUpper} yet.\n` +
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
