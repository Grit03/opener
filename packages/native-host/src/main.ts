#!/usr/bin/env node

import { NativeHost } from "./host.ts";
import { translate } from "./translate.ts";

const host = new NativeHost(process.stdin, process.stdout);
const MAX_ACTIVE_TRANSLATIONS = 4;
let activeTranslations = 0;

host.on("translate.request", async (request) => {
  // TODO: provider, targetLanguage, segments를 검증하고 잘못된 요청에 INVALID_REQUEST를 반환한다.
  // 빈 segments와 중복 세그먼트 ID도 거부한다.
  if (activeTranslations >= MAX_ACTIVE_TRANSLATIONS) {
    return {
      type: "translate.error",
      code: "BUSY",
      message: "Too many active translation requests.",
    };
  }

  activeTranslations += 1;
  try {
    // TODO: AbortController를 호스트 연결 종료와 연결해 실행 중인 번역을 취소한다.
    const result = await translate(request, new AbortController().signal);
    return { type: "translate.result", ...result };
  } catch (error) {
    return {
      type: "translate.error",
      code: "TRANSLATION_FAILED",
      // TODO: 내부 오류 상세 대신 클라이언트용 일반 오류 메시지를 반환한다.
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    activeTranslations -= 1;
  }
});

await host.listen();
