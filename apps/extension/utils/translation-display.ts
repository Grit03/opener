import { isBlock, type UppercaseHtmlTagName } from "./layout";
import {
  collectTextForTranslation,
  isSourceTextTranslatable,
  type SourceText,
} from "./text-collection";

export interface TranslationDisplayController {
  /** 원문을 새로 수집하고 화면에 들어오는 글에 번역을 표시한다. */
  enable(): void;
  /** 표시한 번역을 모두 지운다. 다시 켤 수 있다. */
  disable(): void;
  /** 표시한 번역을 지우고 컨트롤러를 폐기한다. 다시 켤 수 없다. */
  destroy(): void;
}

const TRANSLATION_TAG = "opener-translation";
const INLINE_TRANSLATION_CLASS = "opener-translation--inline";
const BLOCK_TRANSLATION_CLASS = "opener-translation--block";
/** 형제로 번역을 끼워 넣으면 HTML 구조가 깨지는 요소. 번역을 요소 안에 넣는다. */
const INNER_TRANSLATION_TAGS: ReadonlySet<string> = new Set<UppercaseHtmlTagName>([
  "HTML",
  "BODY",
  "MAIN",
  "ARTICLE",
  "UL",
  "OL",
  "MENU",
  "DL",
  "LI",
  "DT",
  "DD",
  "TABLE",
  "THEAD",
  "TBODY",
  "TFOOT",
  "TR",
  "TH",
  "TD",
  "CAPTION",
]);

/** 화면에 들어온 번역 후보 옆에 번역 표시 영역을 만든다. */
export function createTranslationDisplayController(
  doc: Document = document,
): TranslationDisplayController {
  const translationElements = new Map<SourceText, HTMLElement>();
  let sourcesByAnchor = new Map<Element, SourceText[]>();
  /** 켜져 있는 동안에만 존재한다. */
  let observer: IntersectionObserver | null = null;
  let destroyed = false;

  /** 아직 표시하지 않은 유효한 원문에 번역 요소를 하나 붙인다. */
  const displayTranslation = (source: SourceText) => {
    if (translationElements.has(source) || !isSourceTextTranslatable(source)) return;

    const translation = createTranslationElement(doc, source);
    if (insertTranslation(source, translation)) translationElements.set(source, translation);
  };

  const enable = () => {
    if (observer || destroyed) return;

    sourcesByAnchor = groupByAnchor(collectTextForTranslation(doc));
    // 숨겨진 탭에서는 브라우저가 교차 계산을 멈췄다가, 다시 보일 때 현재 상태로 알린다.
    const current = new IntersectionObserver((entries) => {
      // disconnect() 전에 쌓인 알림은 끈 뒤에도 전달될 수 있다.
      if (current !== observer) return;

      entries
        .filter((entry) => entry.isIntersecting)
        .flatMap((entry) => sourcesByAnchor.get(entry.target) ?? [])
        .forEach(displayTranslation);
    });
    for (const anchor of sourcesByAnchor.keys()) current.observe(anchor);
    observer = current;
  };

  const disable = () => {
    observer?.disconnect();
    observer = null;
    sourcesByAnchor.clear();
    translationElements.forEach((translation) => translation.remove());
    translationElements.clear();
  };

  const destroy = () => {
    disable();
    destroyed = true;
  };

  enable();

  return { enable, disable, destroy };
}

/** 기준 요소의 display에 맞춰 인라인 또는 블록 번역 요소를 만든다. */
function createTranslationElement(doc: Document, source: SourceText): HTMLElement {
  const translation = doc.createElement(TRANSLATION_TAG);
  const isInline = !isBlock(source.anchor);

  translation.className = isInline ? INLINE_TRANSLATION_CLASS : BLOCK_TRANSLATION_CLASS;
  translation.setAttribute("aria-hidden", "true");
  // TODO: 번역 통신을 연결하면 source.text 대신 번역 결과를 표시한다.
  translation.textContent = source.text;
  return translation;
}

/** IntersectionObserver 알림(요소)에서 원문을 찾을 수 있도록 원문을 기준 요소별로 묶는다. */
function groupByAnchor(sources: SourceText[]): Map<Element, SourceText[]> {
  const sourcesByAnchor = new Map<Element, SourceText[]>();
  for (const source of sources) {
    const group = sourcesByAnchor.get(source.anchor) ?? [];
    group.push(source);
    sourcesByAnchor.set(source.anchor, group);
  }
  return sourcesByAnchor;
}

/**
 * 번역 요소를 넣고 성공 여부를 돌려준다.
 * 일반 요소는 기준 요소 바로 뒤에 넣는다. 목록·표 요소는 형제로 넣으면 HTML이 깨지므로
 * 요소 안에서 원문을 품은 직계 자식 뒤에 넣는다. 맨 끝에 넣으면 하위 목록 뒤로 밀리고,
 * 원문 텍스트 바로 뒤에 넣으면 링크 안에 들어가기 때문이다.
 *
 * 예:
 * <li>                                 ← anchor
 *   <span>Wrapped <a>item</a></span>   ← "item"을 품은 직계 자식. 이 뒤에 넣는다.
 *   <ul><li>Child item</li></ul>       ← 하위 목록
 * </li>
 */
function insertTranslation({ anchor, sourceNodes }: SourceText, translation: HTMLElement): boolean {
  if (!INNER_TRANSLATION_TAGS.has(anchor.tagName)) {
    anchor.after(translation);
    return translation.isConnected;
  }

  const lastSourceTextNode = sourceNodes.at(-1) ?? null; // ① 마지막 원문 텍스트 노드: "item"
  const lastSourceChild = [...anchor.childNodes] // ② anchor의 직계 자식들: [<span>, <ul>]
    .find((child) => child.contains(lastSourceTextNode)); // ③ "item"을 품은 자식은? → <span>
  lastSourceChild?.after(translation); // ④ <span> 뒤에 넣는다
  return lastSourceChild !== undefined;
}
