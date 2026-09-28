import { isValidNativeHostRequest } from "@opener/protocol";
import { describe, expect, test } from "vitest";
import { parseTranslationResult } from "../src/translate.ts";
import { createRequest, createResult } from "./fixtures.ts";

describe("네이티브 호스트 요청 타입 검증", () => {
  test("번역 요청 타입을 허용한다", () => {
    expect(isValidNativeHostRequest(createRequest())).toBe(true);
  });

  test.each([
    { reason: "null", input: null },
    { reason: "문자열", input: "translate.request" },
    { reason: "type 필드 누락", input: {} },
    { reason: "지원하지 않는 타입", input: { type: "unknown.request" } },
  ])("$reason 요청을 거부한다", ({ input }) => {
    expect(isValidNativeHostRequest(input)).toBe(false);
  });
});

describe("번역 요청 내용 검증", () => {
  test.todo("provider, targetLanguage, segments가 누락된 요청을 거부한다");
  test.todo("지원하지 않는 provider를 거부한다");
  test.todo("빈 segments를 거부한다");
  test.todo("중복된 세그먼트 ID를 거부한다");
});

describe("번역 결과 검증", () => {
  test("요청한 모든 세그먼트의 번역을 허용한다", () => {
    const request = createRequest();
    const result = createResult();

    const parsed = parseTranslationResult(result, request);

    expect(parsed).toStrictEqual(result);
  });

  test("번역 순서가 바뀌어도 ID로 세그먼트를 확인한다", () => {
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

    const parsed = parseTranslationResult(result, request);

    expect(parsed).toStrictEqual(result);
  });

  test("번역 개수가 요청과 같아도 중복 ID를 거부한다", () => {
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

    expect(() => parseTranslationResult(result, request)).toThrow();
  });

  test.each([
    { reason: "번역 누락", translations: [] },
    { reason: "요청하지 않은 ID", translations: [{ id: "other", text: "번역" }] },
    { reason: "빈 번역문", translations: [{ id: "title", text: " " }] },
  ])("$reason 결과를 거부한다", ({ translations }) => {
    const request = createRequest();

    expect(() => parseTranslationResult({ translations }, request)).toThrow();
  });
});
