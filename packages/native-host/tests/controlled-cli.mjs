#!/usr/bin/env node
import { connect } from "node:net";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input);
const socket = connect(process.env.OPENER_TEST_SOCKET);
let outcome = "";
for await (const chunk of socket) outcome += chunk;

if (outcome !== "success") {
  process.exitCode = 1;
} else {
  process.stdout.write(
    JSON.stringify({
      type: "result",
      subtype: "success",
      structured_output: {
        translations: request.segments.map(({ id }) => ({ id, text: "안녕하세요" })),
      },
    }),
  );
}
