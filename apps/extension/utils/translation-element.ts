export const TRANSLATION_TAG = "opener-translation";

/** 원문 수집과 DOM 변경 감지에서 제외할 번역 표시 요소인지 확인한다. */
export function isTranslationElement(node: Node): boolean {
  return node instanceof Element && node.localName === TRANSLATION_TAG;
}
