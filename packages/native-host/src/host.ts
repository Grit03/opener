import {
  isNonEmptyString,
  isNonArrayObject,
  parseTranslateRequest,
  type TranslateRequest,
  type TranslateResponse,
} from "@opener/protocol";
import type { Readable, Writable } from "node:stream";
import { readNativeMessages, writeNativeMessage } from "./native-messaging.ts";
import type { Translator } from "./translate.ts";

const MAX_ACTIVE_REQUESTS = 4;

async function translateRequest(
  request: TranslateRequest,
  translate: Translator,
  output: Writable,
  signal: AbortSignal,
): Promise<void> {
  try {
    const result = await translate(request, signal);
    const response = { type: "translate.result", batchId: request.batchId, ...result };
    // Include the response envelope when checking the browser's message limit.
    if (!signal.aborted) {
      await writeNativeMessage(output, response);
    }
  } catch {
    const response = {
      type: "translate.error",
      batchId: request.batchId,
      code: "TRANSLATION_FAILED",
      message: "Translation failed. Check CLI installation, login, and response format.",
    };
    if (!signal.aborted) {
      await writeNativeMessage(output, response);
    }
  }
}

export async function serveNativeHost(
  input: Readable,
  output: Writable,
  translate: Translator,
  signal: AbortSignal,
): Promise<void> {
  const connection = new AbortController();
  const activeRequests = new Map<string, Promise<void>>();
  const disconnect = () => connection.abort();
  const stopReading = () => input.destroy();
  const handleOutputError = (error: Error) => {
    input.destroy(error);
  };

  input.once("end", disconnect);
  input.once("close", disconnect);
  output.once("error", handleOutputError);
  signal.addEventListener("abort", stopReading, { once: true });

  try {
    signal.throwIfAborted();
    for await (const message of readNativeMessages(input)) {
      let request: TranslateRequest;
      try {
        request = parseTranslateRequest(message);
      } catch {
        const batchId =
          isNonArrayObject(message) && isNonEmptyString(message.batchId) ? message.batchId : null;
        await writeNativeMessage(output, {
          type: "translate.error",
          batchId,
          code: "INVALID_REQUEST",
          message: "Expected a provider, target language, and segments with unique ids.",
        } satisfies TranslateResponse);
        continue;
      }

      if (activeRequests.size >= MAX_ACTIVE_REQUESTS || activeRequests.has(request.batchId)) {
        await writeNativeMessage(output, {
          type: "translate.error",
          batchId: request.batchId,
          code: "BUSY",
          message: "Too many active requests or a duplicate batch id.",
        } satisfies TranslateResponse);
        continue;
      }

      const task = translateRequest(request, translate, output, connection.signal)
        .catch(handleOutputError)
        .finally(() => activeRequests.delete(request.batchId));
      activeRequests.set(request.batchId, task);
    }
  } finally {
    connection.abort();
    await Promise.all(activeRequests.values());
    input.removeListener("end", disconnect);
    input.removeListener("close", disconnect);
    output.removeListener("error", handleOutputError);
    signal.removeEventListener("abort", stopReading);
  }
}
