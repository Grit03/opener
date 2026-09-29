// 페이지에서 번역할 글을 모은다. 이 파일에서 쓰는 용어는 다음과 같다.
//
// - 본문 영역(contentArea): 글을 모을 범위가 되는 요소. main에서 모은 글이 없으면 article을,
//   그래도 없으면 body를 쓴다. 같은 태그가 여러 개면 모두 쓰고, 중첩되면 바깥쪽만 쓴다.
// - 경계 요소: 앞뒤 글을 나누는 요소. h1~h6·p·li·dt·dd·caption·th·td·br은 CSS와 관계없이
//   경계 요소이고, 그 밖의 요소는 계산된 display가 인라인(inline) 계열이 아닐 때 경계 요소다.
// - 기준 요소(anchor): 텍스트 노드에서 부모 방향으로 올라가며 처음 만나는 경계 요소. 본문 영역에
//   닿을 때까지 경계 요소가 없으면 본문 영역이 기준 요소다.
// - 글: 기준 요소가 같고 사이에 경계 요소가 없는 텍스트 노드들을 이어 붙인 것. SourceText 하나가
//   글 하나다.
//
// 예) <main>Intro<p>Hello <a>world</a>!</p></main>
//
//   main               ← 본문 영역
//   ├─ "Intro"         → 글 1
//   └─ p               ← 경계 요소
//      ├─ "Hello "     → 글 2
//      ├─ a            ← 인라인이라 글을 나누지 않는다
//      │  └─ "world"   → 글 2
//      └─ "!"          → 글 2
//
//   결과: "Intro"(기준 요소 main), "Hello world!"(기준 요소 p)

import { type HtmlTagName, isBlock, type UppercaseHtmlTagName } from "./layout";
import { getTextforTranslation, isTranslatableText } from "./translation-target";

/** 같은 기준 요소 안에서 경계 요소를 사이에 두지 않는 텍스트 노드들을 묶은 글. */
export interface SourceText {
  text: string;
  /** 텍스트의 가장 가까운 경계 요소. 없으면 수집한 본문 영역. */
  anchor: Element;
  sourceNodes: Text[];
}

const CONTENT_AREA_TAGS = ["main", "article"] as const satisfies HtmlTagName[];
type ContentAreaTag = (typeof CONTENT_AREA_TAGS)[number];

/** CSS와 관계없이 글을 나눈다. 빈 요소나 br도 앞뒤 글을 나누는 경계다. */
const TEXT_BOUNDARY_TAGS: ReadonlySet<string> = new Set<UppercaseHtmlTagName>([
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "P",
  "LI",
  "DT",
  "DD",
  "CAPTION",
  "TH",
  "TD",
  "BR",
]);

/**
 * 웹 사이트의 메인 본문 영역이라고 생각되는 부분을 찾는다.
 * main → article → body 순으로 시도하고, 글이 모인 첫 후보의 결과를 문서 순서대로 반환한다.
 */
export function collectTextForTranslation(doc: Document = document): SourceText[] {
  if (!doc.body) return [];

  for (const tag of CONTENT_AREA_TAGS) {
    const contentAreas = findOutermostContentAreas(doc.body, tag);
    const collected = contentAreas.flatMap(collectTextWithin);
    if (collected.length > 0) return collected;
  }
  return collectTextWithin(doc.body);
}

/** 수집 이후 DOM이 바뀌었을 수 있으므로, 표시 전에 연결·포함 관계와 번역 가능 여부를 확인한다. */
export function isSourceTextTranslatable({ anchor, sourceNodes }: SourceText): boolean {
  const isAnchorInDocument = anchor.isConnected;
  const hasSourceNodes = sourceNodes.length > 0;
  if (!isAnchorInDocument || !hasSourceNodes) return false;

  return sourceNodes.every((node) => {
    const isStillInAnchor = node.isConnected && anchor.contains(node);
    return isStillInAnchor && isTranslatableText(node);
  });
}
/**
 * body 안에서 본문 영역 태그(main 또는 article)가 여러 개 중첩되어 있을때,
 * 가장 바깥쪽에 있는 본문 영역만 반환한다. 중첩된 안쪽 본문 영역은 제외한다.
 */
function findOutermostContentAreas(body: HTMLElement, tag: ContentAreaTag): HTMLElement[] {
  return [...body.querySelectorAll(tag)].filter((element) => !element.parentElement?.closest(tag));
}

/**
 * 본문 영역 안의 텍스트 노드를 문서 순서대로 훑으며 글로 묶는다.
 * 경계 요소가 시작되거나 기준 요소가 바뀌면, 그때까지 모은 텍스트 노드를 글 하나로 확정한다.
 */
function collectTextWithin(contentArea: Element): SourceText[] {
  const collected: SourceText[] = [];
  let pendingAnchor: Element = contentArea;
  let pendingTextNodes: Text[] = [];

  /** 모은 텍스트 노드를 글 하나로 확정하고 비운다. 공백뿐이거나 한글이 있는 글은 결과에 넣지 않는다. */
  const finishPendingText = () => {
    const text = getTextforTranslation(pendingTextNodes);
    if (text !== null) {
      collected.push({ text, anchor: pendingAnchor, sourceNodes: pendingTextNodes });
    }
    pendingTextNodes = [];
  };

  for (const node of walkElementsAndTexts(contentArea)) {
    if (node instanceof Element) {
      // 경계 요소가 시작되면 앞에서 모은 글을 확정한다.
      // 빈 경계 요소도 앞뒤 글을 나누므로 텍스트 노드의 기준 요소 변화만으로는 부족하다.
      if (isTextBoundary(node)) finishPendingText();
      continue;
    }

    // 제외한 인라인 글의 앞뒤는 기존 기준 요소에서 이어 붙인다.
    if (!isTranslatableText(node)) continue;

    const anchor = findAnchor(node, contentArea);
    // TreeWalker는 닫는 태그를 방문하지 않는다. 경계 요소 밖으로 돌아온 것은 기준 요소의 변화로 알아챈다. 예: li 안의 p 뒤에 이어지는 글.
    if (anchor !== pendingAnchor) finishPendingText();

    pendingAnchor = anchor;
    pendingTextNodes.push(node);
  }

  finishPendingText();
  return collected;
}

/** 본문 영역 자신을 제외하고 요소와 텍스트를 문서 순서대로 방문한다. */
function* walkElementsAndTexts(contentArea: Element): Generator<Element | Text> {
  const walker = contentArea.ownerDocument.createTreeWalker(
    contentArea,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );

  while (walker.nextNode() !== null) {
    const node = walker.currentNode;
    if (node instanceof Element || node instanceof Text) yield node;
  }
}

/**
 * 텍스트 노드의 기준 요소를 찾는다. 부모 방향으로 올라가며 경계 요소가 아닌 요소(a·em·span 등)는
 * 지나치고, 처음 만나는 경계 요소를 반환한다. 본문 영역에 닿을 때까지 없으면 본문 영역을 반환한다.
 */
function findAnchor(text: Text, contentArea: Element): Element {
  let candidate = text.parentElement;
  while (candidate !== null && candidate !== contentArea && !isTextBoundary(candidate)) {
    candidate = candidate.parentElement;
  }
  return candidate ?? contentArea;
}

function isTextBoundary(element: Element): boolean {
  return TEXT_BOUNDARY_TAGS.has(element.tagName) || isBlock(element);
}
