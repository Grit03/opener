# 번역할 본문 수집 작업

이 작업 전체를 `001-text-collection` PR 하나로 진행한다. 결과 표시, 동적 감지, 플로팅 버튼은 후속 기능에서 다룬다. 각 단계별로 진행한 다음 사용자에게 확인을 받고 커밋 후 이후 작업을 진행한다.

## 1단계: 준비

- [ ] T001 `apps/extension/utils/text-collection.ts`에 수집 결과 형식과 빈 수집 함수의 공개 인터페이스를 만들고, `apps/extension/tests/text-collection.test.ts`에 테스트 준비 코드를 작성한다.

## 2단계: 본문 선택

- [ ] T002 [RED] `apps/extension/tests/text-collection.test.ts`에 본문 선택 우선순위, 문서 순서와 중첩 영역 중복 제거 테스트를 작성하고 실패를 확인한다.
- [ ] T003 [GREEN] `apps/extension/utils/text-collection.ts`에 본문 선택과 중첩 영역 제거를 구현해 T002 테스트를 통과시킨다.

## 3단계: 텍스트 묶기

- [ ] T004 [RED] `apps/extension/tests/text-collection.test.ts`에 문단·목록·표·줄바꿈 경계와 링크·강조·인라인 코드 결합 테스트를 작성하고 실패를 확인한다.
- [ ] T005 [GREEN] `apps/extension/utils/text-collection.ts`에서 `apps/extension/utils/layout.ts`의 블록 판정을 사용해 텍스트 탐색과 묶기를 구현하고 T004 테스트를 통과시킨다.

## 4단계: 제외 조건

- [ ] T006 [RED] `apps/extension/tests/text-collection.test.ts`에 입력·편집·숨김·번역 금지·코드 블록·언어 조건 테스트를 작성하고 실패를 확인한다.
- [ ] T007 [GREEN] `apps/extension/utils/text-collection.ts`에 제외, 숨김과 언어 판정을 구현해 T006 테스트를 통과시킨다.

## 5단계: 중복과 원문 보호

- [ ] T008 [RED] `apps/extension/tests/text-collection.test.ts`에 빈 글과 반복 수집의 중복 제거, 원문 요소·링크·입력값 보존 테스트를 작성하고 실패를 확인한다.
- [ ] T009 [GREEN] `apps/extension/utils/text-collection.ts`에 빈 글과 중복 결과 처리를 구현해 T008 테스트와 앞선 테스트를 모두 통과시킨다.

## 6단계: 정리

- [ ] T010 [REFACTOR] 전체 테스트가 통과하는 상태에서 `apps/extension/utils/text-collection.ts`와 `apps/extension/tests/text-collection.test.ts`의 중복과 이름을 정리한다.
- [ ] T011 `apps/extension/utils/text-collection.ts`, `apps/extension/utils/layout.ts`, `apps/extension/tests/text-collection.test.ts`의 형식 검사, 타입 검사, 린트와 전체 단위 테스트를 통과시킨다.
