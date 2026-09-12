# 번역할 본문 수집 작업

`001-text-collection` 한 기능만 구현한다. 결과 표시, 동적 변경 감지와 확장 프로그램 연결은 포함하지 않는다.

## 1단계: 준비

- [ ] [T001] `apps/extension/utils/text-collection.ts`에 수집 결과 타입을 선언하고, `apps/extension/tests/text-collection.test.ts`에서 기존 DOM fixture 도구를 준비한다. 실행 동작은 아직 구현하지 않는다.

## 2단계: 기반 동작 — 본문 선택과 탐색

- [ ] [T002] [RED] `apps/extension/tests/text-collection.test.ts`에 `main → article → body` 선택 순서, 겹치지 않는 범위, 문서 순서, 반환 참조, 빈 글 제외, 반복 호출의 독립된 결과와 DOM 보존 테스트를 작성하고 기대한 이유로 실패하는지 확인한다. 테스트 실행에 필요한 빈 함수는 테스트 작성 후 추가한다. `(R1, R4, R9, R10, C2, C5, C6)`
- [ ] [T003] [GREEN] `apps/extension/utils/text-collection.ts`에 상태를 저장하지 않는 본문 선택과 `TreeWalker` 탐색을 최소 구현해 T002를 통과시킨다.

## 3단계: 사용자 이야기 1 — 읽기 단위로 묶기

- [ ] [T004] [RED] `apps/extension/tests/text-collection.test.ts`와 `apps/extension/tests/layout.test.ts`에 제목·문단·목록·표·`br` 경계, 링크·강조·인라인 코드 결합과 계산된 `display` 테스트를 작성하고 실패를 확인한다. `(R2, R3, C1, C2)`
- [ ] [T005] [GREEN] `apps/extension/utils/text-collection.ts`에 의미 경계와 텍스트 묶기를 구현하고, T004에서 필요성이 확인된 경우에만 `apps/extension/utils/layout.ts`의 `isBlock`을 보완해 테스트를 통과시킨다.

## 4단계: 사용자 이야기 2 — 수집하면 안 되는 영역 제외

- [ ] [T006] [RED] `apps/extension/tests/text-collection.test.ts`에 문서·실행 영역, 입력·편집 영역, 상속된 `translate`, `pre`, 블록·인라인 `code`, 프레임·비문자 콘텐츠 테스트를 작성하고 실패를 확인한다. `(R5, R6, R7, C3)`
- [ ] [T007] [GREEN] `apps/extension/utils/text-collection.ts`에 T006의 제외 판정을 최소 구현해 테스트를 통과시킨다.

## 5단계: 사용자 이야기 3 — 표시 상태와 언어 판정

- [ ] [T008] [RED] `apps/extension/tests/text-collection.test.ts`에 `hidden`의 CSS 재표시, 닫힌 `details`, `display: none|contents`, `visibility`, `opacity`, `content-visibility: hidden|auto`와 `Range` 영역 테스트를 작성하고 Chromium에서 실패를 확인한다. `(R6, C3)`
- [ ] [T009] [GREEN] `apps/extension/utils/text-collection.ts`에 `checkVisibility()`와 보조 `Range` 판정을 구현해 T008을 통과시킨다.
- [ ] [T010] [RED] `apps/extension/tests/text-collection.test.ts`에 `en`, 영어 지역 태그, 다른 언어, 빈 값·누락·유효하지 않은 `lang`과 상속 테스트를 작성하고 실패를 확인한다. `(R8, C4)`
- [ ] [T011] [GREEN] `apps/extension/utils/text-collection.ts`에 가장 가까운 `lang`과 `Intl.Locale` 판정을 구현해 T010을 통과시킨다.

## 6단계: 정리와 검증

- [ ] [T012] [REFACTOR] 모든 테스트가 통과하는 상태에서 `apps/extension/utils/text-collection.ts`와 `apps/extension/tests/text-collection.test.ts`의 이름과 중복만 정리한다.
- [ ] [T013] `apps/extension/utils/text-collection.ts`, `apps/extension/utils/layout.ts`, `apps/extension/tests/text-collection.test.ts`에 대해 전체 테스트, 타입 검사, 린트와 형식 검사를 통과시킨다.
