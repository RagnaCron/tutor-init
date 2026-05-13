import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import { addVersionCommand, detectVersion, loadVersionConfig, patchVersion, scaffoldTutor } from "./utils.ts";


export default function (pi: ExtensionAPI) {

  pi.registerCommand("tutor-init", {
    description: "Scaffold a project-local tutor in .pi/ — usage: /tutor-init <language>",
    handler: async (args, ctx) => {
      const lang = (args ?? "").trim().toLowerCase();

      if (!lang) {
        ctx.ui.notify("Usage: /tutor-init <language>  e.g. /tutor-init go", "warning");
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
      const detected = detectVersion(cwd, lang);

      if (detected) {
        const embed = await ctx.ui.confirm(
          "Runtime detected",
          `Detected ${lang} ${detected}. Embed this version in AGENTS.md?`
        );
        if (embed) {
          version = detected;
        }
      } else {
        const config = loadVersionConfig(cwd);
        if (config?.versionCommands?.[lang]) {
          ctx.ui.notify(
            `Command configured for "${lang}" but failed to detect a version. ` +
            `A placeholder will be added — fill it in manually in .pi/AGENTS.md.`,
            "info"
          );
        } else {
          ctx.ui.notify(
            `No command configured for "${lang}". ` +
            `Run /tutor-add-lang ${lang} to add a version detection command, ` +
            `or fill the placeholder manually in .pi/AGENTS.md.`,
            "info"
          );
        }
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

  pi.registerCommand("tutor-sync-lang", {
    description: "Re-detect the runtime version and patch .pi/AGENTS.md",
    handler: async (_, ctx) => {
      const cwd = process.cwd();
      const agentsMdPath = path.join(cwd, ".pi", "AGENTS.md");

      if (!fs.existsSync(agentsMdPath)) {
        ctx.ui.notify(
          "No .pi/AGENTS.md found. Run /tutor-init <language> first.",
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
      const config = loadVersionConfig(cwd);
      const cmd = config?.versionCommands?.[lang];

      if (!cmd) {
        ctx.ui.notify(
          `No command configured for "${lang}". ` +
          `Run /tutor-add-lang ${lang} first.`,
          "warning"
        );
        return;
      }

      const detected = detectVersion(cwd, lang);

      if (!detected) {
        ctx.ui.notify(
          `Could not run the configured command for "${lang}". ` +
          `Check the command in .pi/tutor-version.json and update it manually.`,
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

  pi.registerCommand("tutor-add-lang", {
    description: "Add a version detection command for a language — usage: /tutor-add-lang <lang>",
    handler: async (args, ctx) => {
      const lang = (args ?? "").trim().toLowerCase();

      if (!lang) {
        ctx.ui.notify("Usage: /tutor-add-lang <language>", "warning");
        return;
      }

      const cwd = process.cwd();
      const config = loadVersionConfig(cwd);
      const existing = config?.versionCommands?.[lang];

      if (existing) {
        ctx.ui.notify(
          `Command already configured for "${lang}": \`${existing}\`. ` +
          `Update it manually in .pi/tutor-version.json.`,
          "info"
        );
        return;
      }

      const input = await ctx.ui.input(
        `Version detection command for "${lang}"`,
        ""
      );

      if (!input?.trim()) {
        ctx.ui.notify("Aborted — command was empty.", "info");
        return;
      }

      addVersionCommand(cwd, lang, input.trim());
      ctx.ui.notify(
        `Added command for "${lang}" (\`${input.trim()}\`). ` +
        `Run /tutor-init ${lang} to scaffold.`,
        "info"
      );
    },
  });
}
