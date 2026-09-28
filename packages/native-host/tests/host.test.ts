import { EventEmitter, once } from "node:events";
import { PassThrough } from "node:stream";
import { expect, onTestFinished, test } from "vitest";
import { serveNativeHost } from "../src/host.ts";
import { encodeNativeMessage, readNativeMessages } from "../src/native-messaging.ts";
import type { Translator } from "../src/translate.ts";
import { createRequest, createResult } from "./fixtures.ts";

function startHost(translate: Translator) {
  const input = new PassThrough();
  const output = new PassThrough();
  const done = serveNativeHost(input, output, translate, new AbortController().signal);
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

  return { input, responses, done };
}

test("rejects an invalid request and continues serving the connection", async () => {
  const { input, responses } = startHost(async () => createResult());

  input.write(encodeNativeMessage({ ...createRequest(), provider: "invalid" }));
  const invalid = await responses.next();
  input.write(encodeNativeMessage(createRequest()));
  const valid = await responses.next();

  expect(invalid.value).toMatchObject({
    type: "translate.error",
    code: "INVALID_REQUEST",
  });
  expect(valid.value).toStrictEqual({
    type: "translate.result",
    ...createResult(),
  });
});

test("같은 내용의 요청도 병렬 처리하고 먼저 완료된 응답을 보낸다", async () => {
  const release = new EventEmitter();
  let started = 0;
  const { input, responses } = startHost(async (_request, signal) => {
    started += 1;
    if (started === 1) await once(release, "first", { signal });
    return createResult();
  });

  input.write(encodeNativeMessage(createRequest()));
  input.write(encodeNativeMessage(createRequest()));
  expect((await responses.next()).value).toStrictEqual({
    type: "translate.result",
    ...createResult(),
  });
  expect(started).toBe(2);

  release.emit("first");
  expect((await responses.next()).value).toStrictEqual({
    type: "translate.result",
    ...createResult(),
  });
});

test("returns a per-request error without exposing translation failure details", async () => {
  const { input, responses } = startHost(async () => {
    throw new Error("PRIVATE_PAGE_TEXT");
  });

  input.write(encodeNativeMessage(createRequest()));
  const response = await responses.next();

  expect(response.value).toMatchObject({
    type: "translate.error",
    code: "TRANSLATION_FAILED",
  });
  expect(JSON.stringify(response.value)).not.toContain("PRIVATE_PAGE_TEXT");
});

test("returns BUSY for a fifth request while four translations are pending", async () => {
  const { input, responses } = startHost(async (_request, signal) => {
    await once(signal, "abort");
    return createResult();
  });

  for (let index = 0; index < 5; index += 1) {
    input.write(encodeNativeMessage(createRequest()));
  }
  const response = await responses.next();

  expect(response.value).toMatchObject({
    type: "translate.error",
    code: "BUSY",
  });
});

test("aborts all active translations when the browser disconnects", async () => {
  const started = new EventEmitter();
  const signals: AbortSignal[] = [];
  const { input, done } = startHost(async (_request, signal) => {
    signals.push(signal);
    if (signals.length === 4) started.emit("ready");
    await once(signal, "abort");
    return createResult();
  });
  const ready = once(started, "ready");
  for (let index = 0; index < 4; index += 1) {
    input.write(encodeNativeMessage(createRequest()));
  }
  await ready;

  input.end();
  await done;

  expect(signals.map((signal) => signal.aborted)).toStrictEqual([true, true, true, true]);
});
