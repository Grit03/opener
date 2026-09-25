export interface Segment {
  id: string;
  text: string;
}

export interface TranslateRequest {
  type: "translate.request";
  batchId: string;
  provider: "claude" | "codex";
  targetLanguage: string;
  segments: Segment[];
}

export interface TranslationResult {
  translations: Segment[];
}

export type TranslateResponse =
  | ({ type: "translate.result"; batchId: string } & TranslationResult)
  | {
      type: "translate.error";
      batchId: string | null;
      code: "INVALID_REQUEST" | "BUSY" | "TRANSLATION_FAILED";
      message: string;
    };

export function isNonArrayObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseSegments(value: unknown): Segment[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Expected a non-empty segment array.");
  }

  const segmentIds = new Set<string>();
  return value.map((segment: unknown) => {
    if (
      !isNonArrayObject(segment) ||
      !isNonEmptyString(segment.id) ||
      !isNonEmptyString(segment.text)
    ) {
      throw new Error("Each segment needs a non-empty id and text.");
    }
    if (segmentIds.has(segment.id)) {
      throw new Error("Segment ids must be unique.");
    }
    segmentIds.add(segment.id);
    return { id: segment.id, text: segment.text };
  });
}

export function parseTranslateRequest(value: unknown): TranslateRequest {
  if (
    !isNonArrayObject(value) ||
    value.type !== "translate.request" ||
    !isNonEmptyString(value.batchId) ||
    (value.provider !== "claude" && value.provider !== "codex") ||
    !isNonEmptyString(value.targetLanguage)
  ) {
    throw new Error("Invalid translation request.");
  }

  return {
    type: "translate.request",
    batchId: value.batchId,
    provider: value.provider,
    targetLanguage: value.targetLanguage,
    segments: parseSegments(value.segments),
  };
}
