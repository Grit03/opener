import { PassThrough } from "node:stream";
import { expect, expectTypeOf, onTestFinished, test } from "vitest";
import type { NativeHostResponse, TranslateRequest } from "@opener/protocol";
import { NativeHost } from "../src/host.ts";
import { encodeNativeMessage, readNativeMessages } from "../src/utils/native-messaging.ts";
import { createRequest, createResult } from "./fixtures.ts";

function startHost(handler: (request: TranslateRequest) => Promise<NativeHostResponse>) {
  const input = new PassThrough();
  const output = new PassThrough();
  const host = new NativeHost(input, output);
  host.on("translate.request", (request) => {
    expectTypeOf(request).toEqualTypeOf<TranslateRequest>();
    return handler(request);
  });
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

test.each([
  { reason: "null", request: null },
  { reason: "문자열", request: "translate.request" },
  { reason: "type 필드가 없는", request: {} },
  { reason: "지원하지 않는 타입의", request: { type: "unknown.request" } },
  { reason: "핸들러가 등록되지 않은 ping", request: { type: "ping" } },
])("$reason 요청에 오류를 응답하고 다음 요청을 처리한다", async ({ request }) => {
  let handled = 0;
  const { input, responses } = startHost(async () => {
    handled += 1;
    return { type: "translate.result", ...createResult() };
  });

  input.write(encodeNativeMessage(request));
  const invalid = await responses.next();
  expect(handled).toBe(0);
  input.write(encodeNativeMessage(createRequest()));
  const valid = await responses.next();

  expect(invalid.value).toMatchObject({
    type: "error",
    code: "INVALID_REQUEST",
  });
  expect(valid.value).toStrictEqual({
    type: "translate.result",
    ...createResult(),
  });
});

test("번역 실패 응답을 전달하고 다음 요청을 처리한다", async () => {
  let handled = 0;
  const { input, responses } = startHost(async () => {
    handled += 1;
    if (handled === 1) {
      return {
        type: "translate.error",
        code: "TRANSLATION_FAILED",
        message: "Translation failed.",
      };
    }
    return { type: "translate.result", ...createResult() };
  });

  input.write(encodeNativeMessage(createRequest()));
  const failed = await responses.next();
  input.write(encodeNativeMessage(createRequest()));
  const succeeded = await responses.next();

  expect(failed.value).toMatchObject({
    type: "translate.error",
    code: "TRANSLATION_FAILED",
  });
  expect(succeeded.value).toStrictEqual({
    type: "translate.result",
    ...createResult(),
  });
});

test.todo("번역 실패의 내부 상세 정보를 응답에 노출하지 않는다");
test.todo("브라우저 연결이 종료되면 실행 중인 번역을 취소한다");
