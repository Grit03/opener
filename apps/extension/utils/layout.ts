/**
 * 요소를 부모의 인라인 흐름에 두는 display 값. contents는 인라인 계열은 아니지만 자기 상자를
 * 만들지 않아 자식이 부모의 흐름에 그대로 놓이므로 함께 둔다.
 */
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

/**
 * 계산된 display가 INLINE_LEVEL에 없으면 블록으로 본다. none도 블록으로 보며, 표시 여부는 여기서
 * 판단하지 않는다. 계산된 값이 비어 있으면(문서에 붙지 않은 요소처럼 스타일이 계산되지 않은 경우)
 * 블록으로 보지 않는다.
 */
export function isBlock(element: Element): boolean {
  const display = getComputedStyle(element).display;
  if (display === "") return false;
  return !INLINE_LEVEL.has(display);
}
