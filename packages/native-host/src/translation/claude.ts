import { isNonArrayObject } from "@opener/protocol";
import { readFileSync } from "node:fs";
import { runCli } from "../utils/run-cli.ts";
import type { CliAdapter } from "./translator.ts";

const resultSchema = readFileSync(
  new URL("./translation-result.schema.json", import.meta.url),
  "utf8",
);

export const runClaude: CliAdapter = async ({ input, instructions, cwd, signal }) => {
  const stdout = await runCli({
    command: "claude",
    args: [
      "-p",
      "--model",
      "haiku",
      "--tools",
      "",
      "--setting-sources",
      "",
      "--safe-mode",
      "--strict-mcp-config",
      "--system-prompt",
      instructions,
      "--json-schema",
      resultSchema,
      "--output-format",
      "json",
      "--no-session-persistence",
    ],
    input,
    cwd,
    signal,
  });

  const message: unknown = JSON.parse(stdout);
  if (
    !isNonArrayObject(message) ||
    message.type !== "result" ||
    message.subtype !== "success" ||
    message.is_error === true ||
    message.structured_output == null
  ) {
    throw new Error("Claude did not return a structured result.");
  }
  return message.structured_output;
};
