#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const provider = basename(process.argv[1]);
const args = process.argv.slice(2);
const valueAfter = (flag) => args[args.indexOf(flag) + 1];
let input = "";
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input.trim().split("\n").at(-1));
assert.equal(request.targetLanguage, "ko");
assert.equal(request.segments[0].text, "Hello");
assert.ok(!args.includes("Hello"));

let schema;
if (provider === "claude") {
  assert.ok(args.includes("--no-session-persistence"));
  assert.equal(valueAfter("--tools"), "");
  schema = JSON.parse(valueAfter("--json-schema"));
} else {
  assert.ok(args.includes("--ephemeral"));
  assert.ok(args.includes("--ignore-user-config"));
  assert.ok(!args.includes("--json"));
  schema = JSON.parse(await readFile(valueAfter("--output-schema"), "utf8"));
}
assert.deepEqual(schema.required, ["translations"]);
const result = { translations: [{ id: "title", text: "안녕하세요" }] };
const output =
  provider === "claude"
    ? { type: "result", subtype: "success", structured_output: result }
    : result;
process.stdout.write(JSON.stringify(output));
