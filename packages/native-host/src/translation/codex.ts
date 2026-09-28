import { fileURLToPath } from "node:url";
import { runCli } from "../utils/run-cli.ts";
import type { CliAdapter } from "./translator.ts";

const resultSchemaPath = fileURLToPath(
  new URL("./translation-result.schema.json", import.meta.url),
);

export const runCodex: CliAdapter = async ({ input, instructions, cwd, signal }) => {
  const stdout = await runCli({
    command: "codex",
    args: [
      "exec",
      "--sandbox",
      "read-only",
      "--ignore-user-config",
      "--ephemeral",
      "--skip-git-repo-check",
      "--color",
      "never",
      "--disable",
      "shell_tool",
      "--disable",
      "multi_agent",
      "--disable",
      "apps",
      "--disable",
      "plugins",
      "--disable",
      "hooks",
      "-c",
      'web_search="disabled"',
      "-c",
      'approval_policy="never"',
      "-c",
      "project_doc_max_bytes=0",
      "-c",
      'history.persistence="none"',
      "--output-schema",
      resultSchemaPath,
      "-",
    ],
    input: `${instructions}\n${input}`,
    cwd,
    signal,
  });

  return JSON.parse(stdout);
};
