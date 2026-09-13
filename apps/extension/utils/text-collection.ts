export interface SourceText {
  text: string;
  anchor: Element;
  sourceNodes: Text[];
}

/**
 * 번역할 텍스트들이 모여있고, 페이지의 본문이라 취급될만한 DOM을 찾는다.
 * main에서 수집한 글이 없으면 article, body 순으로 수집 범위를 넓힌다.
 */
export function collectTextForTranslation(doc: Document = document): SourceText[] {
  if (!doc.body) return [];

  for (const tag of ["main", "article"]) {
    // 같은 태그가 중첩돼 있을 때 바깥쪽만 남긴다.
    const roots = [...doc.body.querySelectorAll(tag)].filter(
      (element) => !element.parentElement?.closest(tag),
    );
    const result = roots.flatMap(collectTextWithin);
    if (result.length > 0) return result;
  }
  return collectTextWithin(doc.body);
}

/**
 * 주어진 본문 안에서 이어지는 글을 묶고, 문단·줄바꿈·블록 배치에 따라 나눈다.
 * 각 글에 기준 요소와 문서 순서대로 모은 원본 텍스트 노드를 담는다.
 */
function collectTextWithin(root: Element): SourceText[] {
  const result: SourceText[] = [];
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  let recentAnchor = root;
  let group: Text[] = [];

  while (walker.nextNode() !== null) {
    const node = walker.currentNode;

    if (node instanceof Element) {
      if (!isTextBoundary(node)) continue;

      // 문단이나 br을 만나면, 그 앞까지 모은 글을 저장한다. 빈 요소도 글을 나눈다.
      const sourceText = createSourceText(recentAnchor, group);
      if (sourceText) result.push(sourceText);
      group = [];
      continue;
    }
    if (!(node instanceof Text)) continue;

    // 인라인 부모를 지나 기준 요소를 찾되, 본문 범위 밖으로는 올라가지 않는다.
    let parentNode = node.parentElement;
    while (parentNode && parentNode !== root && !isTextBoundary(parentNode)) {
      parentNode = parentNode.parentElement;
    }
    const anchor = parentNode ?? root;

    // 안쪽 문단에서 바깥 글로 돌아온 경우에도 이전 묶음을 마무리한다.
    if (anchor !== recentAnchor) {
      const sourceText = createSourceText(recentAnchor, group);
      if (sourceText) result.push(sourceText);
      group = [];
    }
    recentAnchor = anchor;
    group.push(node);
  }

  // 마지막 글 뒤에는 다음 요소가 없으므로 탐색이 끝난 뒤 한 번 더 저장한다.
  const sourceText = createSourceText(recentAnchor, group);
  if (sourceText) result.push(sourceText);
  return result;
}

/** 원본 노드의 글을 합쳐 수집 결과를 만들고, 공백뿐이면 null을 반환한다. */
function createSourceText(anchor: Element, sourceNodes: Text[]): SourceText | null {
  // 원문을 먼저 합친 뒤 연속된 공백·탭·줄바꿈과 앞뒤 공백을 정리한다.
  const text = sourceNodes
    .map((node) => node.data)
    .join("")
    .replace(/\s+/gu, " ")
    .trim();

  return text ? { text, anchor, sourceNodes } : null;
}

// // --------------------------------------------------------------------------------
// // 레이아웃
// // --------------------------------------------------------------------------------

const TEXT_BOUNDARY_TAGS = new Set([
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

const INLINE_LEVEL = new Set([
  "inline",
  "inline-block",
  "inline-flex",
  "inline-grid",
  "inline-table",
  "contents",
  "ruby",
  "ruby-base",
  "ruby-text",
]);

/** 제목·문단·목록·표의 구분 요소이거나(인라인이어도) 블록 배치이면 주변 글과 나눈다. */
function isTextBoundary(element: Element): boolean {
  return TEXT_BOUNDARY_TAGS.has(element.tagName) || isBlock(element);
}

/** 계산된 display가 인라인 배치나 contents 목록에 없으면 블록으로 취급한다. */
function isBlock(el: Element): boolean {
  const display = getComputedStyle(el).display;
  if (display === "") return false;
  return !INLINE_LEVEL.has(display);
}
