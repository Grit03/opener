import { parseTranslateRequest } from "@opener/protocol";
import { describe, expect, test } from "vitest";
import { parseTranslationResult } from "../src/translate.ts";
import { createRequest, createResult } from "./fixtures.ts";

describe("translation requests", () => {
  test("accepts a request with unique segments", () => {
    const request = createRequest();

    const parsed = parseTranslateRequest(request);

    expect(parsed).toStrictEqual(request);
  });

  test.each([
    { reason: "a missing request", input: () => null },
    { reason: "an unsupported provider", input: () => ({ ...createRequest(), provider: "sh" }) },
    { reason: "no segments", input: () => createRequest({ segments: [] }) },
    {
      reason: "duplicate segment ids",
      input: () =>
        createRequest({
          segments: [
            { id: "title", text: "Hello" },
            { id: "title", text: "World" },
          ],
        }),
    },
  ])("rejects $reason", ({ input }) => {
    const request = input();

    expect(() => parseTranslateRequest(request)).toThrow();
  });
});

describe("translation results", () => {
  test("accepts a translation for every requested segment", () => {
    const request = createRequest();
    const result = createResult();

    const parsed = parseTranslationResult(result, request);

    expect(parsed).toStrictEqual(result);
  });

  test("matches segments by id even when translations arrive in reverse order", () => {
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

  test("rejects duplicate ids even when the translation count matches the request", () => {
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
    { reason: "missing translations", translations: [] },
    { reason: "an unrequested id", translations: [{ id: "other", text: "번역" }] },
    { reason: "blank translation text", translations: [{ id: "title", text: " " }] },
  ])("rejects $reason", ({ translations }) => {
    const request = createRequest();

    expect(() => parseTranslationResult({ translations }, request)).toThrow();
  });
});
