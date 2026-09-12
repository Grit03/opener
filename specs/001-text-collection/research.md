# 번역할 본문 수집 기술 조사

## 조사 기준

- `spec.md`와 프로젝트 constitution을 기능 범위와 개발 원칙으로 삼았다.
- 웹 표준과 MDN을 우선했고, 외부 번역 확장 프로그램의 구현은 조사하지 않았다.
- 레이아웃 관련 판단은 저장소의 Vitest Browser Mode에서 Chromium으로 확인했다.

## 1. 본문 영역 선택

**결정**

1. 읽을 수 있는 최상위 `main`이 있으면 이를 사용한다.
2. 없으면 읽을 수 있는 최상위 `article`을 문서 순서대로 사용한다.
3. 둘 다 없으면 `body`를 사용한다.
4. 같은 단계의 후보가 중첩되면 바깥 후보만 남긴다.

**근거**

`main`은 문서의 주된 내용을, `article`은 독립적으로 완결된 내용을 나타낸다. `body`는 의미 있는 본문 표시가 없는 문서까지 처리하기 위한 마지막 범위다. 이 우선순위 자체는 웹 표준이 정한 알고리즘이 아니라 Opener의 제품 규칙이다.

**검토한 대안**

- 항상 `body` 사용: 메뉴와 주변 글이 지나치게 많이 포함된다.
- 글자 수나 클래스 이름으로 본문 추정: 1.0 범위에 비해 규칙이 복잡하고 결과를 예측하기 어렵다.

**출처**

- [WHATWG: main 요소](https://html.spec.whatwg.org/multipage/grouping-content.html#the-main-element)
- [WHATWG: article 요소](https://html.spec.whatwg.org/multipage/sections.html#the-article-element)

## 2. 의미상 수집 경계

**결정**

- `h1`~`h6`, `p`, `li`, `dt`, `dd`, `caption`, `th`, `td`를 명시적인 수집 단위로 삼는다.
- `br`을 만나면 현재 단위를 끝낸다.
- 경계 안의 링크, 강조 요소와 인라인 `code`는 주변 글과 이어 붙인다.
- 경계가 중첩되면 가장 안쪽 경계가 자신의 텍스트를 맡아 중복을 막는다.

**근거**

HTML 요소의 의미는 CSS 배치와 별개다. 문단, 목록 항목, 용어 설명, 표의 제목과 각 칸은 내용상 독립된 단위이므로 스타일이 바뀌어도 경계를 유지해야 한다.

**검토한 대안**

- 모든 블록 요소를 경계로 사용: CSS 변경만으로 의미상 한 문장이 불필요하게 나뉠 수 있다.
- `textContent`를 한 번에 읽기: 링크 안팎의 순서는 보존되지만 문단과 표의 경계를 잃는다.

**출처**

- [WHATWG: p 요소와 문단](https://html.spec.whatwg.org/multipage/grouping-content.html#the-p-element)
- [WHATWG: 목록 요소](https://html.spec.whatwg.org/multipage/grouping-content.html#the-li-element)
- [WHATWG: 표와 셀](https://html.spec.whatwg.org/multipage/tables.html#tabular-data)
- [WHATWG: 제목 요소](https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines)

## 3. 계산된 `display`와 시각적 경계

**결정**

- 의미 경계가 없는 요소만 `getComputedStyle()`의 `display`로 보완한다.
- 바깥 표시 유형이 `inline`인 요소는 현재 단위에 합치고, `block`인 요소는 경계로 본다.
- `display: contents`는 자체 경계를 만들지 않고 자식 배치를 따른다.
- 별도의 블록 태그 목록은 만들지 않는다. 기존 `isBlock`은 Chromium 테스트로 부족한 경우에만 수정한다.

**근거**

블록과 인라인은 HTML 태그의 고정 분류가 아니라 CSS 배치 특성이다. CSS Display 표준도 `display`를 바깥 표시 유형과 안쪽 배치 방식으로 구분한다.

**검토한 대안**

- 태그 이름으로만 판정: `span { display: block }`, `div { display: inline }`을 잘못 처리한다.
- `display`만으로 모든 경계 판정: 제목과 표의 의미상 경계가 사이트 CSS에 따라 사라질 수 있다.

**출처**

- [CSSWG: display의 바깥·안쪽 유형](https://drafts.csswg.org/css-display-3/#the-display-properties)
- [MDN: 블록 레이아웃](https://developer.mozilla.org/en-US/docs/Glossary/Block-level_content)
- [MDN: getComputedStyle](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle)

## 4. 탐색 순서

**결정**

- 요소와 텍스트 노드를 함께 보는 `TreeWalker`로 각 본문 영역을 앞에서 뒤로 탐색한다.
- 제외할 요소는 `FILTER_REJECT`로 자식까지 건너뛴다.
- 의미 없는 래퍼는 `FILTER_SKIP`으로 래퍼만 넘기고 자식은 계속 탐색한다.
- 텍스트 노드의 원래 문자열을 순서대로 합친 뒤 공백을 한 번만 정리한다.

**근거**

`TreeWalker`는 DOM 트리 순서를 따르며, 요소를 방문할 때 하위 트리를 통째로 제외할 수 있다. HTML 소스의 줄바꿈과 들여쓰기도 텍스트 노드가 되므로 공백뿐인 노드는 결과에서 제거해야 한다.

**검토한 대안**

- 텍스트 노드만 찾는 선택자 조합: 제외 영역마다 조상을 다시 검사해야 하고 가지치기가 어렵다.
- 요소별 `querySelectorAll`: 요소 사이에 직접 놓인 텍스트와 중첩된 경계의 순서를 다루기 어렵다.

**출처**

- [DOM 표준: TreeWalker](https://dom.spec.whatwg.org/#interface-treewalker)
- [MDN: createTreeWalker와 필터](https://developer.mozilla.org/en-US/docs/Web/API/Document/createTreeWalker)
- [WHATWG: 요소 사이 공백 텍스트](https://html.spec.whatwg.org/multipage/dom.html#content-models)

## 5. 제외 영역

**결정**

- 문서·실행 영역: `head`, `script`, `style`, `template`, `noscript`
- 입력·편집 영역: `input`, `textarea`, `select`, `option`, 편집 가능한 요소
- 코드 블록: `pre`, 또는 블록으로 표시되는 `code`; 인라인 `code`는 유지
- 별도 문서·비문자 영역: `iframe`, `object`, `embed`, `canvas`, `svg`, `math`, `audio`, `video`
- 번역 금지 영역: 각 HTML 요소의 상속이 반영된 `translate` 값이 `false`인 경우

**근거**

입력값과 편집 영역은 사용자의 작업 대상이며 본문이 아니다. `translate`는 부모의 상태를 상속하고 안쪽의 `translate="yes"`로 다시 허용할 수 있으므로, 단순히 `translate="no"` 조상만 찾으면 안 된다. `pre` 전체 제외는 코드 중심 제품 범위를 위한 1.0 정책이다.

**검토한 대안**

- 모든 `code` 제외: 문장 안의 짧은 명령까지 빠져 요구사항과 맞지 않는다.
- 클래스 이름으로 코드 편집기 탐지: 사이트별 규칙이 필요하므로 1.0에서 다루지 않는다.

**출처**

- [WHATWG: translate 속성과 상속](https://html.spec.whatwg.org/multipage/dom.html#the-translate-attribute)
- [WHATWG: 편집 가능한 영역](https://html.spec.whatwg.org/multipage/interaction.html#attr-contenteditable)
- [WHATWG: pre와 code](https://html.spec.whatwg.org/multipage/grouping-content.html#the-pre-element)

## 6. 숨김과 실제 표시 여부

**결정**

1. 텍스트를 감싸는 가장 가까운 `display`가 `contents`가 아닌 요소에서 `checkVisibility()`를 사용한다.
2. `display: none`, `content-visibility: hidden`, 닫힌 `details`의 `summary` 밖 내용은 제외한다.
3. `opacity: 0`과 계산된 `visibility: hidden|collapse`도 옵션으로 확인해 제외한다.
4. `content-visibility: auto`로 화면 밖 렌더링이 생략된 글은 제외하지 않는다.
5. 남은 텍스트는 `Range.getClientRects()`에 너비와 높이가 있는 영역이 있는지 확인한다. 단, `content-visibility: auto` 아래의 글은 빈 영역만으로 제외하지 않는다.

**근거**

`hidden` 속성은 CSS로 표시가 복구될 수 있다. 반대로 `display`, `visibility`, `opacity`는 조상 상태의 영향까지 고려해야 한다. `checkVisibility()`는 이 조건과 `details`의 실제 렌더링 상태를 함께 판정한다. `content-visibility: auto`는 화면 밖 콘텐츠를 잠시 그리지 않는 최적화이므로 숨김과 같지 않다.

Chromium 확인 결과, CSS로 `display: block`을 준 `hidden` 요소는 표시 대상으로 판정됐다. 닫힌 `details`, `opacity: 0`, `content-visibility: hidden`의 자식은 표시되지 않는 것으로 판정됐고, `visibility: visible`로 다시 보이게 한 자식과 화면 밖 `content-visibility: auto`의 자식은 표시 대상으로 남았다. `Range`는 닫힌 `details`에도 영역을 돌려줄 수 있어 단독 판정에는 쓰지 않는다.

**검토한 대안**

- `hidden` 속성만 확인: 실제 화면에는 보이는 요소를 놓칠 수 있다.
- `Range` 영역만 확인: 닫힌 `details`와 렌더링 억제 상태를 정확히 구분하지 못한다.
- 화면 밖 요소 제외: 스크롤해서 읽을 본문을 잃는다.

**출처**

- [WHATWG: hidden과 렌더링](https://html.spec.whatwg.org/multipage/interaction.html#the-hidden-attribute)
- [WHATWG: details 요소](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-details-element)
- [CSSWG: content-visibility](https://drafts.csswg.org/css-contain-2/#content-visibility)
- [MDN: checkVisibility](https://developer.mozilla.org/en-US/docs/Web/API/Element/checkVisibility)
- [MDN: Range.getClientRects](https://developer.mozilla.org/en-US/docs/Web/API/Range/getClientRects)

## 7. 영어 영역 판정

**결정**

- 텍스트에서 가장 가까운 조상의 `lang` 속성을 사용한다.
- 유효한 태그의 기본 언어가 `en`이면 포함하고, 다른 언어면 제외한다.
- `lang`이 없거나 빈 값이거나 유효하지 않으면 언어를 알 수 없는 후보로 남긴다.
- 언어 태그의 유효성은 브라우저의 `Intl.Locale`로 확인한다.

**근거**

HTML의 언어는 가까운 조상에서 상속되며 빈 문자열은 언어를 모른다는 뜻이다. 영어 지역 태그인 `en-US`, `en-GB` 등도 영어로 처리해야 한다.

**검토한 대안**

- 영문자 비율로 감지: 짧은 제목, 고유명사와 코드에서 오판이 많다.
- 문서 최상위 `lang`만 사용: 한 페이지 안에서 언어가 바뀌는 영역을 구분하지 못한다.

**출처**

- [WHATWG: lang 속성과 언어 상속](https://html.spec.whatwg.org/multipage/dom.html#the-lang-and-xml:lang-attributes)
- [MDN: Intl.Locale](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale)

## 8. 단일 수집과 DOM 보호

**결정**

- 수집 결과는 텍스트, 기준 요소와 원본 텍스트 노드 목록을 가진다.
- 호출할 때마다 현재 문서의 결과를 새 배열로 반환하고 이전 결과를 보관하지 않는다.
- 본문 영역이 겹치지 않게 선택하고 `TreeWalker`로 각 노드를 한 번만 방문한다.
- 페이지 요소에는 식별용 속성을 추가하지 않고 읽기 전용 DOM API만 사용한다.

**근거**

`main`을 선택하면 그 안의 `article`과 `p`는 하위 노드로 한 번만 방문한다. 다시 수집할 때도 기존 배열에 더하지 않고 새로운 결과를 만들면 이 단계에서 별도의 중복 상태가 필요하지 않다.

**검토한 대안**

- `WeakMap`으로 이전 수집 상태 유지: 동적 콘텐츠 감지에서 판단할 내용이므로 현재 범위를 넘는다.
- 페이지에 `data-*` 식별자 추가: 원문 DOM을 변경하므로 요구사항과 맞지 않는다.

**출처**

- [DOM 표준: TreeWalker](https://dom.spec.whatwg.org/#interface-treewalker)
- [기능 요구사항 R9·R10](./spec.md#기능-요구사항)

## Chromium 기반 단위 테스트 항목

- CSS로 표시가 바뀐 `span`, `div`, `inline-block`, `display: contents`
- CSS로 다시 표시한 `hidden` 요소
- 닫힌 `details`의 `summary`와 나머지 내용
- 조상과 자식의 `visibility`가 다른 경우
- 조상의 `opacity: 0`
- `content-visibility: hidden`과 화면 밖 `auto`
- 실제 크기가 없는 텍스트와 정상 텍스트의 `Range` 영역
