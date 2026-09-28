import type { TranslateRequest, TranslationResult } from "@opener/protocol";

export function createRequest(overrides: Partial<TranslateRequest> = {}): TranslateRequest {
  return {
    type: "translate.request",
    provider: "claude",
    targetLanguage: "ko",
    segments: [{ id: "title", text: "Hello" }],
    ...overrides,
  };
}

export function createResult(): TranslationResult {
  return { translations: [{ id: "title", text: "안녕하세요" }] };
}
