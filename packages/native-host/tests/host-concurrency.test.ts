import { EventEmitter, once } from "node:events";
import { PassThrough } from "node:stream";
import type { NativeHostRequest, NativeHostResponse } from "@opener/protocol";
import { expect, onTestFinished, test } from "vitest";
import { NativeHost } from "../src/host.ts";
import { encodeNativeMessage, readNativeMessages } from "../src/utils/native-messaging.ts";
import { createRequest, createResult } from "./fixtures.ts";

function startHost(handler: (request: NativeHostRequest) => Promise<NativeHostResponse>) {
  const input = new PassThrough();
  const output = new PassThrough();
  const host = new NativeHost(input, output).on("translate.request", handler);
  const done = host.listen();
  const responses = readNativeMessages(output);

  onTestFinished(async () => {
    input.end();
    try {
      await done;
    } finally {
      input.destroy();
      output.destroy();
    }
  });

  return { input, responses };
}

test("앞선 요청의 처리가 끝나지 않아도 다음 요청을 처리한다", async () => {
  const release = new EventEmitter();
  let started = 0;
  const { input, responses } = startHost(async () => {
    started += 1;
    if (started <= 4) await once(release, "all");
    return { type: "translate.result", ...createResult() };
  });
  onTestFinished(() => {
    release.emit("all");
  });

  for (let index = 0; index < 5; index += 1) {
    input.write(encodeNativeMessage(createRequest()));
  }

  expect((await responses.next()).value).toStrictEqual({
    type: "translate.result",
    ...createResult(),
  });
  expect(started).toBe(5);
});
