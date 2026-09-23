// 페이지에서 번역할 글을 모은다. 이 파일에서 쓰는 용어는 다음과 같다.
//
// - 본문 영역(contentArea): 글을 모을 범위가 되는 요소. main에서 모은 글이 없으면 article을,
//   그래도 없으면 body를 쓴다. 같은 태그가 여러 개면 모두 쓰고, 중첩되면 바깥쪽만 쓴다.
// - 경계 요소: 앞뒤 글을 나누는 요소. h1~h6·p·li·dt·dd·caption·th·td·br은 CSS와 관계없이
//   경계 요소이고, 그 밖의 요소는 계산된 display가 인라인 계열이 아닐 때 경계 요소다.
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

import { isBlock } from "./layout";

export interface SourceText {
  text: string;
  anchor: Element;
  sourceNodes: Text[];
}

const CONTENT_AREA_TAGS = ["main", "article"];

/**
 * 본문 영역에서 번역할 글을 모아 문서 순서대로 반환한다.
 * 본문 영역은 main, article, body 순으로 시도하고, 앞 후보에서 모은 글이 없을 때만 다음으로 넘어간다.
 */
export function collectTextForTranslation(doc: Document = document): SourceText[] {
  if (!doc.body) return [];

  for (const tag of CONTENT_AREA_TAGS) {
    // 이 태그의 요소를 모두 본문 영역으로 쓰되, 같은 태그 안에 중첩된 요소는 뺀다.
    // 중첩된 요소까지 쓰면 바깥 요소를 훑을 때 이미 모은 글을 한 번 더 모은다.
    const contentAreas = findOutermost(doc.body, tag);
    const collected = contentAreas.flatMap(collectTextWithin);
    if (collected.length > 0) return collected;
  }
  return collectTextWithin(doc.body);
}

/**
 * 수집한 뒤 표시하기 전까지 페이지가 바뀔 수 있다.
 * 기준 요소와 원문 노드가 문서에 연결되어 있는지 확인한다.
 * 원문 노드가 기존 기준 요소 안에 남아 있고 현재도 번역 가능한지도 확인한다.
 */
export function isSourceTextTranslatable(sourceText: SourceText): boolean {
  const { anchor, sourceNodes } = sourceText;
  // Node.isConnected는 노드가 현재 문서의 DOM 트리에 연결되어 있는지 나타낸다.
  const isAnchorInDocument = anchor.isConnected;
  const hasSourceNodes = sourceNodes.length > 0;
  if (!isAnchorInDocument || !hasSourceNodes) return false;

  const areAllSourceNodesStillTranslatable = sourceNodes.every((sourceNode) => {
    const isSourceNodeInDocument = sourceNode.isConnected;
    if (!isSourceNodeInDocument) return false;

    const isSourceNodeInsideAnchor = anchor.contains(sourceNode);
    if (!isSourceNodeInsideAnchor) return false;

    const isSourceNodeStillTranslatable = isTranslatable(sourceNode);
    return isSourceNodeStillTranslatable;
  });

  return areAllSourceNodesStillTranslatable;
}

/** container 안의 tag 요소 중 같은 태그의 조상이 없는 것만 문서 순서대로 반환한다. */
function findOutermost(container: Element, tag: string): Element[] {
  const matched = [...container.querySelectorAll(tag)];
  return matched.filter((element) => !element.parentElement?.closest(tag));
}

/**
 * 본문 영역 안의 텍스트 노드를 문서 순서대로 훑으며 글로 묶는다.
 * 경계 요소가 시작되거나 기준 요소가 바뀌면, 그때까지 모은 텍스트 노드를 글 하나로 확정한다.
 */
function collectTextWithin(contentArea: Element): SourceText[] {
  const collected: SourceText[] = [];
  let pendingAnchor: Element = contentArea;
  let pendingNodes: Text[] = [];

  /** 모은 텍스트 노드를 글 하나로 확정하고 비운다. 공백뿐이거나 한글이 있는 글은 결과에 넣지 않는다. */
  const finishPendingText = () => {
    const sourceText = createSourceText(pendingAnchor, pendingNodes);
    if (sourceText) collected.push(sourceText);
    pendingNodes = [];
  };

  // TreeWalker는 노드를 문서 순서(전위 순회)로 한 번씩 방문한다. 요소는 자손보다 먼저 방문되고,
  // 요소가 끝나는 시점(닫는 태그)은 방문되지 않는다. 그래서 요소를 만난 때는 늘 그 요소의 시작이다.
  for (const node of walkElementsAndTexts(contentArea)) {
    if (node instanceof Element) {
      // 경계 요소가 시작되면 앞에서 모은 글을 확정한다. br이나 빈 p처럼 안에 텍스트가 없는
      // 경계 요소는 기준 요소를 바꾸지 않으므로, 이 분기에서만 앞뒤 글을 나눌 수 있다.
      if (isTextBoundary(node)) finishPendingText();
      continue;
    }

    // 번역하지 않을 글은 모으지 않는다. 기준 요소도 갱신하지 않으므로 앞뒤 글은 그대로 이어진다.
    if (!isTranslatable(node)) continue;

    // 이 텍스트 노드의 기준 요소
    const textAnchor = findAnchor(node, contentArea);
    // 기준 요소가 바뀌면 앞 글을 확정한다. 경계 요소가 시작될 때는 위 분기에서 이미 확정했으므로,
    // 실제로 필요한 경우는 경계 요소가 끝나고 바깥 글로 돌아왔을 때다. 예: li 안의 p가 끝난 뒤
    // 이어지는 li의 글. 끝나는 시점은 방문되지 않으니 기준 요소가 달라진 것으로 알아챈다.
    if (textAnchor !== pendingAnchor) finishPendingText();

    pendingAnchor = textAnchor;
    pendingNodes.push(node);
  }

  // 마지막 글은 뒤따르는 경계 요소나 기준 요소 변화가 없어 아직 확정되지 않았으므로 여기서 확정한다.
  finishPendingText();
  return collected;
}

/** 본문 영역 안의 요소와 텍스트 노드를 문서 순서대로 내놓는다. 본문 영역 자신은 내놓지 않는다. */
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

/** 원본 노드의 글을 합쳐 수집 결과를 만들고, 공백뿐이거나 목표 언어의 글이면 null을 반환한다. */
function createSourceText(anchor: Element, sourceNodes: Text[]): SourceText | null {
  // 노드 경계에 걸친 공백도 하나로 합쳐지도록 먼저 이어 붙인다. 그다음 연속된 공백 문자
  // (\s: 스페이스·탭·줄바꿈·NBSP 등)를 스페이스 하나로 바꾸고 앞뒤 공백을 없앤다.
  const text = sourceNodes
    .map((node) => node.data)
    .join("")
    .replace(/\s+/gu, " ")
    .trim();

  // 한글 여부는 노드마다가 아니라 이어 붙인 글 전체로 판단한다. 노드마다 보면 한국어 문장 안의
  // 영어 링크 글만 따로 남는다.
  if (!text || TARGET_SCRIPT.test(text)) return null;
  return { text, anchor, sourceNodes };
}

// --------------------------------------------------------------------------------
// 경계 요소 판정
// --------------------------------------------------------------------------------

/**
 * CSS display와 관계없이 앞뒤 글을 나누는 경계 요소로 보는 태그. br은 안에 글이 없지만 앞뒤 글을 나눈다.
 * 번역을 어디에 넣을지 정하는 translation-display의 INNER_TRANSLATION_TAGS와는 기준이 다르다.
 */
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

/** 경계 요소인지 판단한다. TEXT_BOUNDARY_TAGS는 CSS와 관계없이, 그 밖의 요소는 블록일 때만 경계다. */
function isTextBoundary(element: Element): boolean {
  return TEXT_BOUNDARY_TAGS.has(element.tagName) || isBlock(element);
}

// --------------------------------------------------------------------------------
// 번역 제외 판정
// --------------------------------------------------------------------------------

/**
 * 안의 글을 번역하지 않는 요소. 자손이 translate="yes"나 contenteditable="false"로 바꿔도
 * 다시 넣지 않는다.
 */
const EXCLUDED_SELECTOR = [
  // 문서 정보·실행 코드
  "title",
  "script",
  "style",
  "noscript",
  "template",
  // 입력·조작 요소
  "textarea",
  "select",
  "datalist",
  "button",
  // 편집 영역. 값이 비어 있어도 편집 가능하다.
  '[contenteditable=""]',
  '[contenteditable="true" i]',
  '[contenteditable="plaintext-only" i]',
  // 서식을 지켜야 하는 글
  "pre",
  // 별도 문서·그래픽·미디어의 대체 콘텐츠
  "iframe",
  "object",
  "svg",
  "math",
  "canvas",
  "audio",
  "video",
].join(", ");

/** 텍스트 노드를 번역할 글에 넣을지 판단한다. 본문 영역 바깥 조상의 설정도 따른다. */
function isTranslatable(text: Text): boolean {
  const parent = text.parentElement;
  if (parent === null || isInExcludedElement(parent) || !isVisible(parent)) return false;
  if (isInTargetLanguage(parent)) return false;

  // HTMLElement.translate는 가장 가까운 유효한 translate 값을 상속해 계산한다.
  // 대소문자를 가리지 않고, 잘못된 값은 무시하고 부모 값을 따른다.
  return !(parent instanceof HTMLElement) || parent.translate;
}

/**
 * 글을 직접 감싼 요소가 화면에 보이는지 계산된 스타일로 판단한다.
 * display: none·hidden, 닫힌 details, content-visibility: hidden, 조상의 opacity: 0은 checkVisibility가 걸러 낸다.
 * 화면 밖이라 렌더링을 건너뛴 content-visibility: auto는 보이는 것으로 본다.
 */
function isVisible(element: Element): boolean {
  // css visibility는 상속되고 자식이 되살릴 수 있으므로 글을 직접 감싼 요소의 계산값만 본다.
  if (getComputedStyle(element).visibility !== "visible") return false;

  // display: contents 요소는 상자가 없어 checkVisibility가 늘 false이므로, 상자가 있는 가장
  // 가까운 조상을 대신 검사한다. contents 요소에는 opacity도 적용되지 않는다.
  let boxed: Element | null = element;
  while (boxed !== null && getComputedStyle(boxed).display === "contents") {
    boxed = boxed.parentElement;
  }
  return boxed !== null && boxed.checkVisibility({ opacityProperty: true });
}

/** 번역 결과의 언어. 이미 이 언어로 쓰인 글은 번역하지 않는다. */
const TARGET_LANGUAGE = "ko";

/**
 * 목표 언어의 문자. lang이 없거나 틀린 페이지도 많아서 글 내용으로 한 번 더 확인한다. 한국어 글에는
 * 영어가 자주 섞이지만 영어 글에 한글이 섞이는 일은 드물어서, 한글이 하나라도 있으면 한국어 글로 본다.
 */
const TARGET_SCRIPT = /\p{Script=Hangul}/u;

/**
 * 가장 가까운 lang이 목표 언어인지 확인한다. lang=""은 "알 수 없음"으로 재지정한 것이므로
 * 조상 값을 따르지 않는다. lang이 없거나 비었거나 잘못된 태그면 목표 언어가 아닌 것으로 본다.
 */
function isInTargetLanguage(element: Element): boolean {
  const lang = element.closest("[lang]")?.getAttribute("lang");
  if (!lang) return false;

  try {
    // Intl.Locale은 대소문자와 지역·문자 태그를 정규화하고, 잘못된 태그면 RangeError를 던진다.
    return new Intl.Locale(lang).language === TARGET_LANGUAGE;
  } catch {
    return false;
  }
}

/** 요소 자신이나 조상이 번역하지 않는 요소인지 확인한다. code는 블록으로 배치될 때만 제외한다. */
function isInExcludedElement(element: Element): boolean {
  for (let current: Element | null = element; current !== null; current = current.parentElement) {
    if (current.matches(EXCLUDED_SELECTOR)) return true;
    if (current.tagName === "CODE" && isBlock(current)) return true;
  }
  return false;
}
