import { isBlock } from "./layout";

const TARGET_LANGUAGE = "ko";
const TARGET_SCRIPT = /\p{Script=Hangul}/u;

/**
 * 번역 대상에서 항상 제외할 요소의 선택자(selector).
 * 해당 요소 안의 텍스트는 자손의 개별 설정과 관계없이 모두 제외한다.
 */
const EXCLUDED_SELECTOR = [
  // 문서 정보·실행 코드
  "title",
  "script",
  "style",
  "noscript",
  "template",
  // 화면에서 숨기고 스크린 리더(screen reader)에 제공하는 텍스트
  ".sr-only",
  // 현재 위치와 페이지 이동 영역
  '[aria-label="Breadcrumb"]',
  '[aria-label="pagination"]',
  // 입력·조작 요소
  "textarea",
  "select",
  "datalist",
  "button",
  // Google·Chrome 번역이 translate="no"처럼 따르는 관례
  ".notranslate",
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

/** 텍스트 노드의 번역 가능 여부. 본문 영역 바깥 조상 element의 설정도 따른다. */
export function isTranslatableText(text: Text): boolean {
  const parent = text.parentElement;
  if (parent === null || isInExcludedElement(parent) || !isVisible(parent)) return false;
  if (isInTargetLanguage(parent)) return false;

  // 가장 가까운 유효한 translate 값을 상속하며, 잘못된 값은 부모 값을 따른다.
  return !(parent instanceof HTMLElement) || parent.translate;
}

/** 노드들을 한 글로 합친다. 공백, 코드, URL뿐이거나 한글이 있으면 번역하지 않는다. */
export function getTextforTranslation(sourceNodes: Text[]): string | null {
  const nodesWithContent = sourceNodes.filter((node) => node.data.trim());
  const containsOnlyCode = nodesWithContent.every((node) => node.parentElement?.closest("code"));
  const containsOnlyUrlLinks = nodesWithContent.every(isUrlLinkText);
  if (containsOnlyCode || containsOnlyUrlLinks) return null;

  // 먼저 이어 붙여 노드 경계의 공백도 정리한다.
  const text = sourceNodes
    .map((node) => node.data)
    .join("")
    .replace(/\s+/gu, " ")
    .trim();

  // lang이 없거나 잘못된 페이지도 있으므로 글 전체에 한글이 있는지 함께 확인한다.
  // 노드마다 판단하면 한국어 문장 안의 영어 링크만 번역 대상으로 남을 수 있다.
  return !text || TARGET_SCRIPT.test(text) ? null : text;
}

function isUrlLinkText(text: Text): boolean {
  const linkText = text.parentElement?.closest("a[href]")?.textContent.trim() ?? "";
  return URL.canParse(linkText) || (linkText.includes(".") && URL.canParse(`https://${linkText}`));
}

function isVisible(element: Element): boolean {
  // 자식이 visibility를 되살릴 수 있으므로 직접 감싼 요소의 계산값만 본다.
  if (getComputedStyle(element).visibility !== "visible") return false;

  // display: contents는 상자가 없어 checkVisibility가 false다. 상자가 있는 조상으로
  // 검사하되 화면 밖 content-visibility: auto는 보이는 것으로 취급한다.
  let boxed: Element | null = element;
  while (boxed !== null && getComputedStyle(boxed).display === "contents") {
    boxed = boxed.parentElement;
  }
  return boxed !== null && boxed.checkVisibility({ opacityProperty: true });
}

function isInTargetLanguage(element: Element): boolean {
  const lang = element.closest("[lang]")?.getAttribute("lang");
  // lang=""은 "알 수 없음"으로 취급
  if (!lang) return false;

  try {
    return new Intl.Locale(lang).language === TARGET_LANGUAGE;
  } catch {
    // 잘못된 언어 태그는 target 언어로 보지 않는다.
    return false;
  }
}

function isInExcludedElement(element: Element): boolean {
  for (let current: Element | null = element; current !== null; current = current.parentElement) {
    if (current.matches(EXCLUDED_SELECTOR)) return true;
    // 인라인 code는 주변 문장에 포함될 수 있다.
    if (current.tagName === "CODE" && isBlock(current)) return true;
  }
  return false;
}
