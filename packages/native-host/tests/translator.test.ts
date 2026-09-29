import { readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, onTestFinished, test, vi } from "vitest";
import { createTranslator } from "../src/translation/translator.ts";
import type { CliAdapter } from "../src/translation/types.ts";
import { createRequest, createResult } from "./fixtures.ts";

describe("주입된 CLI 어댑터로 번역", () => {
  test.each(["claude", "codex"] as const)(
    "%s를 선택하면 해당 어댑터의 결과를 반환한다",
    async (provider) => {
      const results = {
        claude: { translations: [{ id: "title", text: "Claude 번역" }] },
        codex: { translations: [{ id: "title", text: "Codex 번역" }] },
      };
      const translate = createTranslator({
        claude: async () => results.claude,
        codex: async () => results.codex,
      });

      const result = await translate(createRequest({ provider }), new AbortController().signal);

      expect(result).toStrictEqual(results[provider]);
    },
  );

  test("대상 언어와 원문을 JSON 데이터로 어댑터에 전달한다", async () => {
    const request = createRequest({
      targetLanguage: "ja",
      segments: [{ id: "title", text: '번역 $(echo unsafe) "quoted"\n다음 줄' }],
    });
    const cliAdapter = vi.fn<CliAdapter>(async () => createResult());
    const translate = createTranslator({ claude: cliAdapter, codex: cliAdapter });

    await translate(request, new AbortController().signal);

    const [invocation] = cliAdapter.mock.calls[0];
    expect(JSON.parse(invocation.input)).toStrictEqual({
      targetLanguage: "ja",
      segments: request.segments,
    });
  });

  test("이미 취소된 요청은 CLI를 실행하지 않는다", async () => {
    const cliAdapter = vi.fn<CliAdapter>(async () => createResult());
    const translate = createTranslator({ claude: cliAdapter, codex: cliAdapter });
    const cancellation = new AbortController();
    const reason = new Error("사용자가 번역을 취소함");
    cancellation.abort(reason);

    await expect(translate(createRequest(), cancellation.signal)).rejects.toBe(reason);

    expect(cliAdapter).not.toHaveBeenCalled();
  });

  test.each([
    { outcome: "success", description: "번역 성공" },
    { outcome: "failure", description: "CLI 실패" },
    { outcome: "invalid", description: "결과 검증 실패" },
    { outcome: "cancelled", description: "실행 중 취소" },
  ])("$description 후 작업 디렉터리와 파일을 정리한다", async ({ outcome }) => {
    const cancellation = new AbortController();
    const failure = new Error("CLI 실행 중단");
    const result = createResult();
    const filesDuringTranslation: string[][] = [];
    const cliAdapter = vi.fn<CliAdapter>(async ({ cwd, signal }) => {
      onTestFinished(() => rm(cwd, { recursive: true, force: true }));
      await writeFile(join(cwd, "page.txt"), "번역할 원문");
      filesDuringTranslation.push(await readdir(cwd));

      if (outcome === "failure") throw failure;
      if (outcome === "invalid") return { translations: [] };
      if (outcome === "cancelled") {
        cancellation.abort(failure);
        signal?.throwIfAborted();
      }
      return result;
    });
    const translate = createTranslator({ claude: cliAdapter, codex: cliAdapter });

    const translation = translate(createRequest(), cancellation.signal);

    if (outcome === "success") {
      await expect(translation).resolves.toStrictEqual(result);
    } else if (outcome === "invalid") {
      await expect(translation).rejects.toThrow();
    } else {
      await expect(translation).rejects.toBe(failure);
    }
    expect(filesDuringTranslation).toStrictEqual([["page.txt"]]);
    const [invocation] = cliAdapter.mock.calls[0];
    await expect(stat(invocation.cwd)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("번역 결과 검증", () => {
  function createTranslatorWithStubbedResult(result: unknown) {
    return createTranslator({
      claude: async () => result,
      codex: async () => result,
    });
  }

  test("요청한 모든 세그먼트의 번역을 허용한다", async () => {
    const request = createRequest();
    const result = createResult();

    const translate = createTranslatorWithStubbedResult(result);

    const parsed = await translate(request, new AbortController().signal);

    expect(parsed).toStrictEqual(result);
  });

  test("번역 순서가 바뀌어도 ID로 세그먼트를 확인한다", async () => {
    const request = createRequest({
      segments: [
        { id: "title", text: "Hello" },
        { id: "body", text: "World" },
      ],
    });
    const result = {
      translations: [
        { id: "body", text: "세계" },
        { id: "title", text: "안녕하세요" },
      ],
    };

    const translate = createTranslatorWithStubbedResult(result);

    const parsed = await translate(request, new AbortController().signal);

    expect(parsed).toStrictEqual(result);
  });

  test("번역 개수가 요청과 같아도 중복 ID를 거부한다", async () => {
    const request = createRequest({
      segments: [
        { id: "title", text: "Hello" },
        { id: "body", text: "World" },
      ],
    });
    const result = {
      translations: [
        { id: "title", text: "안녕하세요" },
        { id: "title", text: "세계" },
      ],
    };

    const translate = createTranslatorWithStubbedResult(result);

    await expect(translate(request, new AbortController().signal)).rejects.toThrow();
  });

  test.each([
    { reason: "번역 누락", translations: [] },
    { reason: "요청하지 않은 ID", translations: [{ id: "other", text: "번역" }] },
    { reason: "빈 번역문", translations: [{ id: "title", text: " " }] },
  ])("$reason 결과를 거부한다", async ({ translations }) => {
    const request = createRequest();
    const translate = createTranslatorWithStubbedResult({ translations });

    await expect(translate(request, new AbortController().signal)).rejects.toThrow();
  });

  test.each([
    { reason: "null", result: null },
    { reason: "문자열", result: "not a result" },
    { reason: "배열", result: [] },
    { reason: "translations 누락", result: {} },
  ])("$reason 응답을 거부한다", async ({ result }) => {
    const translate = createTranslatorWithStubbedResult(result);

    await expect(translate(createRequest(), new AbortController().signal)).rejects.toThrow();
  });
});
