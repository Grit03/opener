# 번역할 본문 수집 작업

`001-text-collection` 한 기능만 구현한다. 결과 표시, 동적 변경 감지와 확장 프로그램 연결은 포함하지 않는다.

- RED: 단위 테스트로 번역 텍스트를 모으는 공개 함수의 결과를 검사하고, 아직 구현하지 않은 동작 때문에 실패하는지 확인한다. 비공개 함수는 직접 테스트하지 않는다.
- GREEN: 바로 앞 RED 테스트를 통과시키는 최소 구현만 추가한다. 기존 테스트도 통과해야 한다.
- 기본적으로 task 하나를 완료하면 멈춘다. RED 완료는 실패 원인을 확인했다는 뜻이며, 구현 완료가 아니다.

## 1단계: 준비

- [x] [T001] `apps/extension/utils/text-collection.ts`에 결과 타입을 선언하고, `apps/extension/tests/text-collection.test.ts`에서 기존 테스트용 DOM 생성 도구를 준비한다.

## 2단계: 본문 선택과 탐색

- [x] [T002] [RED] `apps/extension/tests/text-collection.test.ts`: 본문 선택(`main → article → body`), DOM 순서, 원본 참조, 빈 글·중복 제외, 반복 호출과 원문 보존을 검증한다. 필요한 빈 함수는 테스트 작성 후 추가한다. `(R1, R4, R9, R10, C2, C5, C6)`
- [x] [T003] [GREEN] `apps/extension/utils/text-collection.ts`: 본문 선택과 `TreeWalker` 탐색을 구현한다. 이전 호출 결과는 저장하지 않는다.

## 3단계: 글을 묶고 나누기

- [x] [T004] [RED] `apps/extension/tests/text-collection.test.ts`: 제목·문단·목록·용어 설명·표·`br`로 글을 나누고, 링크·강조·인라인 코드와 공백을 함께 묶는지 검증한다. 중첩·빈 요소와 CSS 배치에 따른 분리도 확인한다. `(R2, R3, C1, C2)`
- [x] [T005] [GREEN] `apps/extension/utils/text-collection.ts`: 글 묶기와 분리를 구현한다. `isBlock`은 T004에서 잘못된 동작이 확인될 때만 수정한다.

## 4단계: 번역하지 않을 글 제외하기

- [ ] [T006] [RED] `apps/extension/tests/text-collection.test.ts`: 문서 정보·실행 코드, 입력·편집 영역, `pre`, 블록 `code`, 프레임·비문자 콘텐츠를 제외하는지 검증한다. 인라인 `code` 유지, `translate` 상속과 자식의 `yes` 재지정도 확인한다. `(R5, R6, R7, C3)`
- [ ] [T007] [GREEN] `apps/extension/utils/text-collection.ts`: T006의 제외 조건을 구현한다.

## 5단계: 표시 여부와 언어 확인

- [ ] [T008] [RED] `apps/extension/tests/text-collection.test.ts`: CSS로 다시 표시한 `hidden`, 닫힌 `details`, `display: none|contents`, 부모·자식의 `visibility`, 조상의 `opacity`, `content-visibility: hidden|auto`와 텍스트 영역을 검증한다. 화면 밖 `auto`의 글은 영역이 없어도 제외하지 않는다. `(R6, C3)`
- [ ] [T009] [GREEN] `apps/extension/utils/text-collection.ts`: `checkVisibility()`와 `Range.getClientRects()`로 표시 여부를 확인한다. T008의 예외 조건을 반영한다.
- [ ] [T010] [RED] `apps/extension/tests/text-collection.test.ts`: `en`, 영어 지역 태그, 다른 언어, 빈 값·누락·잘못된 `lang`을 검증한다. 부모의 언어 상속과 자식의 재지정도 확인한다. `(R8, C4)`
- [ ] [T011] [GREEN] `apps/extension/utils/text-collection.ts`: 가장 가까운 `lang`과 `Intl.Locale`로 언어를 확인해 번역할 텍스트에 포함하거나 제외한다.

## 6단계: 정리와 검증

- [ ] [T012] [REFACTOR] 모든 테스트가 통과하는 상태에서 `apps/extension/utils/text-collection.ts`와 `apps/extension/tests/text-collection.test.ts`의 이름과 중복만 정리한다.
- [ ] [T013] `apps/extension/utils/text-collection.ts`와 `apps/extension/tests/text-collection.test.ts`에 대해 전체 테스트, 타입 검사, 린트와 형식 검사를 통과시킨다.
