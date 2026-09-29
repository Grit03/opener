import { isBlock, type UppercaseHtmlTagName } from "./layout";
import { isTranslationElement, TRANSLATION_TAG } from "./translation-element";
import {
  collectTextForTranslation,
  isSourceTextTranslatable,
  type SourceText,
} from "./text-collection";

/** 원문 수집·화면 진입 감지·번역 요소를 관리하며 번역 표시를 켜고 끄는 객체. */
export interface TranslationDisplayController {
  /** 원문과 이후 DOM 변경을 수집하고 화면에 들어오는 글에 번역을 표시한다. */
  enable(): void;
  /** 표시한 번역을 모두 지운다. 다시 켤 수 있다. */
  disable(): void;
  /** 표시한 번역을 지우고 번역 표시 기능을 종료한다. 이후 enable() 호출은 무시한다. */
  destroy(): void;
}

const INLINE_TRANSLATION_CLASS = "opener-translation--inline";
const BLOCK_TRANSLATION_CLASS = "opener-translation--block";

/** 어떤 DOM 변경을 관찰할지 옵션을 정의 */
const PAGE_MUTATION_OBSERVER_OPTIONS: MutationObserverInit = {
  subtree: true, // 관찰 대상인 html의 모든 자손까지 포함한다.
  childList: true, // 본문 교체나 지연 로딩으로 노드가 추가·제거되는 경우.
  characterData: true, // 기존 텍스트 노드를 유지한 채 내용만 바꾸는 경우.
  attributes: true, // 속성 변경도 관찰
};

/** 기준 요소 안에서 원문을 품은 직계 자식 뒤에 번역을 넣는 태그. */
const INSERT_AFTER_SOURCE_TAGS: ReadonlySet<string> = new Set<UppercaseHtmlTagName>([
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
  let translationDisplayCleanup: (() => void) | null = null;
  let destroyed = false;

  const enable = () => {
    if (translationDisplayCleanup || destroyed) return;
    translationDisplayCleanup = showTranslations(doc);
  };

  const disable = () => {
    translationDisplayCleanup?.();
    translationDisplayCleanup = null;
  };

  const destroy = () => {
    disable();
    destroyed = true;
  };

  enable();

  return { enable, disable, destroy };
}

/** 번역 표시를 켤 때 원문·옵저버(observer)·번역 요소를 만들고, 함께 정리하는 함수를 반환한다. */
function showTranslations(doc: Document): () => void {
  // IntersectionObserver는 텍스트가 아닌 요소를 관찰한다. 기준 요소를 한 번씩 등록하고,
  // 콜백(callback)의 entry.target으로 그 요소에 속한 원문을 모두 찾을 수 있도록 묶어 둔다.
  let sourcesByAnchor = groupByAnchor(collectTextForTranslation(doc));
  const translationElements = new Map<SourceText, HTMLElement>();
  let active = true;
  let refreshFrame: number | null = null;

  const removeTranslation = (source: SourceText) => {
    translationElements.get(source)?.remove();
    translationElements.delete(source);
  };

  const displayTranslation = (source: SourceText) => {
    if (translationElements.has(source) || !isSourceTextTranslatable(source)) return;

    const translation = createTranslationElement(doc, source);
    if (insertTranslation(source, translation)) translationElements.set(source, translation);
  };

  const observer = new IntersectionObserver((entries) => {
    // 번역 표시를 끈 뒤 콜백(callback)이 실행되더라도 이전 원문으로 번역을 만들지 않는다.
    if (!active || refreshFrame !== null) return;

    entries
      .filter((entry) => entry.isIntersecting)
      .flatMap((entry) => sourcesByAnchor.get(entry.target) ?? [])
      .forEach(displayTranslation);
  });
  for (const anchor of sourcesByAnchor.keys()) observer.observe(anchor);

  const refreshSources = () => {
    refreshFrame = null;
    if (!active) return;

    const nextSourcesByAnchor = groupByAnchor(collectTextForTranslation(doc));
    for (const [anchor, sources] of sourcesByAnchor) {
      const nextSources = nextSourcesByAnchor.get(anchor) ?? [];
      if (isSameSourceGroup(sources, nextSources)) {
        // 기존 객체를 Map의 키로 유지하면 번역을 새 원문 객체에 다시 연결할 필요가 없다.
        nextSourcesByAnchor.set(anchor, sources);
        continue;
      }

      // 일부 번역만 다시 붙이면 표시 순서가 달라질 수 있어 바뀐 그룹은 함께 제거한다.
      sources.forEach(removeTranslation);
    }

    for (const [source, translation] of translationElements) {
      if (!source.anchor.contains(translation)) removeTranslation(source);
      else updateTranslationLayout(translation, source.anchor);
    }

    // 관찰 대상을 새 기준 요소로 바꾼다. observe()는 등록 직후 현재 교차 상태로 콜백을 한 번
    // 호출하므로, 지워진 번역도 화면 안에 있으면 스크롤 없이 다시 표시된다.
    observer.disconnect();
    sourcesByAnchor = nextSourcesByAnchor;
    for (const anchor of sourcesByAnchor.keys()) observer.observe(anchor);
  };

  const mutationObserver = new MutationObserver((records) => {
    if (!active || refreshFrame !== null || !records.some(isPageMutation)) return;
    // 연속된 DOM 변경은 한 프레임에 한 번만 수집한다.
    refreshFrame = requestAnimationFrame(refreshSources);
  });
  mutationObserver.observe(doc.documentElement, PAGE_MUTATION_OBSERVER_OPTIONS);

  return () => {
    active = false;
    mutationObserver.disconnect();
    if (refreshFrame !== null) cancelAnimationFrame(refreshFrame);
    observer.disconnect();
    sourcesByAnchor.clear();
    for (const source of translationElements.keys()) removeTranslation(source);
  };
}

/** 글의 순서·내용·원문 노드가 모두 같을 때만 기존 그룹을 재사용한다. */
function isSameSourceGroup(sources: SourceText[], nextSources: SourceText[]): boolean {
  return (
    sources.length === nextSources.length &&
    sources.every((source, index) => {
      const candidate = nextSources[index];
      return (
        candidate !== undefined &&
        candidate.text === source.text &&
        candidate.sourceNodes.length === source.sourceNodes.length &&
        candidate.sourceNodes.every((node, nodeIndex) => node === source.sourceNodes[nodeIndex])
      );
    })
  );
}

/** 확장이 만든 번역의 삽입·제거·내용 변경으로 다시 수집하지 않는다. */
function isPageMutation(record: MutationRecord): boolean {
  const target = record.target instanceof Element ? record.target : record.target.parentElement;
  if (target?.closest(TRANSLATION_TAG)) return false;
  if (record.type !== "childList") return true;
  return [...record.addedNodes, ...record.removedNodes].some((node) => !isTranslationElement(node));
}

/** 기준 요소의 display에 맞춰 인라인 또는 블록 번역 요소를 만든다. */
function createTranslationElement(doc: Document, source: SourceText): HTMLElement {
  const translation = doc.createElement(TRANSLATION_TAG);

  updateTranslationLayout(translation, source.anchor);
  translation.setAttribute("aria-hidden", "true");
  // TODO: 번역 통신을 연결하면 source.text 대신 번역 결과를 표시한다.
  translation.textContent = source.text;
  return translation;
}

function updateTranslationLayout(translation: HTMLElement, anchor: Element): void {
  translation.className = isBlock(anchor) ? BLOCK_TRANSLATION_CLASS : INLINE_TRANSLATION_CLASS;
}

/**
 * 같은 기준 요소(anchor)를 가진 원문들을 묶는다.
 * 특정 요소에 속한 원문을 찾을 때 전체 원문 배열을 다시 훑지 않고 Map에서 꺼낼 수 있다.
 * 키는 기준 요소인 Element 객체이고, 값은 그 요소를 기준으로 수집한 SourceText 배열이다.
 * 태그 이름이 같아도 서로 다른 요소라면 별도 그룹이 된다.
 *
 * 기준 요소 하나에 원문이 여러 개일 수 있으므로 값은 배열로 보관한다.
 * 예를 들어 <p>First<br>Second</p>에서는 br 때문에 원문이 둘로 나뉘지만 기준 요소는 같은 p다.
 * 이 경우 p를 키로 조회하면 "First"와 "Second"의 SourceText를 함께 얻는다.
 *
 * 각 그룹은 입력 배열에서의 순서를 유지한다. 원문을 하나의 문장으로 합치거나 DOM을 바꾸지는 않는다.
 */
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
 * 일반 요소는 기준 요소(anchor) 안의 맨 끝에 넣는다. 목록·표·본문 영역에서는
 * 마지막 원문 텍스트가 속한 직계 자식 뒤에 넣는다.
 * 맨 끝에 넣으면 하위 목록 뒤로 밀리고, 원문 텍스트 바로 뒤에 넣으면 링크 안에 들어가기 때문이다.
 *
 * 예:
 * <li>                                 ← anchor
 *   <span>Wrapped <a>item</a></span>     ← "item"을 품은 직계 자식. 이 뒤에 넣는다.
 *   <ul><li>Child item</li></ul>        ← 하위 목록
 * </li>
 */
function insertTranslation({ anchor, sourceNodes }: SourceText, translation: HTMLElement): boolean {
  if (!INSERT_AFTER_SOURCE_TAGS.has(anchor.tagName)) {
    anchor.append(translation);
    return translation.isConnected;
  }

  // 위 예시에서 요소 사이에 들여쓰기용 공백 텍스트 노드가 없는 경우:
  const lastSourceNode = sourceNodes.at(-1) ?? null; // ① 마지막 원문 텍스트 노드: "item"
  const lastSourceChild = [...anchor.childNodes] // ② anchor의 직계 자식 노드들: [<span>, <ul>]
    .find((child) => child.contains(lastSourceNode)); // ③ "item"을 포함하는 자식은? → <span>
  lastSourceChild?.after(translation); // ④ <span> 뒤에 넣는다.
  return lastSourceChild !== undefined;
}
