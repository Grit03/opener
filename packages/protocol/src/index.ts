/*
 * ==========================================
 *                Native Host
 * ==========================================
 */

export type NativeHostRequest = TranslateRequest | { type: "ping" };
export type NativeHostResponse = NativeHostErrorResponse | TranslateResponse;

export type NativeHostErrorResponse = {
  type: "error";
  code: "INVALID_REQUEST" | "HANDLER_FAILED";
  message: string;
};

export function isValidNativeHostRequest(message: unknown): message is NativeHostRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message.type === "translate.request" || message.type === "ping")
  );
}

/*
 * ==========================================
 *                Translation
 * ==========================================
 */
export interface TranslateRequest {
  type: "translate.request";
  provider: "claude" | "codex";
  targetLanguage: string;
  segments: Segment[];
}

export interface TranslationResult {
  translations: Segment[];
}

export interface Segment {
  id: string;
  text: string;
}

export type TranslateResponse =
  | ({ type: "translate.result" } & TranslationResult)
  | {
      type: "translate.error";
      code: "INVALID_REQUEST" | "BUSY" | "TRANSLATION_FAILED";
      message: string;
    };

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

/*
 * ==========================================
 *                Utilities
 * ==========================================
 */
export function isNonArrayObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
