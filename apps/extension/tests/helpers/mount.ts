/**
 * fixture HTML 을 `document.body` 직속으로 붙인다.
 *
 * content script 가 훑는 것과 같은 트리를 만들기 위해 래퍼 요소를 두지 않는다.
 * 문자열은 `<template>` 으로 파싱하므로 `<tr><td>` 같은 조각도 유지되고,
 * `<script>` 가 섞여 있어도 실행되지 않는다.
 *
 * 붙이는 것이지 갈아끼우는 것이 아니다. 기존 body 자식은 그대로 남고 새 요소가 뒤에 추가된다.
 * 테스트 사이의 정리는 `tests/setup.ts` 의 `afterEach` 가 body 를 비우는 것으로 한다.
 *
 * @param html - body 에 붙일 HTML 문자열. 보통 `spec/fixture.html` 을 `?raw` 로 읽은 것
 * @example
 * mount('<p id="t1">Hello <b>world</b> again</p>');
 * const ctl = createController({ root: document.body, translate });
 * expect(document.querySelector("#t1")).not.toBeNull();
 */
export function mount(html: string): void {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  document.body.append(tpl.content);
}
