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
 * 주어진 요소 안의 텍스트 노드를 문서 순서대로 수집한다.
 * 공백을 정리한 뒤 빈 글은 제외하고, 각 글에 부모 요소와 원본 노드 참조를 담는다.
 */
function collectTextWithin(root: Element): SourceText[] {
  const result: SourceText[] = [];
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    // 연속된 공백·탭·줄바꿈을 공백 하나로 바꾸고, 앞뒤 공백을 제거한다.
    const text = node.textContent!.replace(/\s+/gu, " ").trim();
    if (text) {
      result.push({
        text,
        anchor: node.parentElement!,
        sourceNodes: [node as Text],
      });
    }
  }
  return result;
}

// --------------------------------------------------------------------------------
// 레이아웃
// --------------------------------------------------------------------------------

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

/** 계산된 display가 인라인 배치나 contents 목록에 없으면 블록으로 취급한다. */
function isBlock(el: Element): boolean {
  const display = getComputedStyle(el).display;
  if (display === "") return false;
  return !INLINE_LEVEL.has(display);
}
