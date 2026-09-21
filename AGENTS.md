# Repository Guidelines

## 프로젝트 구조

- `apps/extension/`: WXT + React 확장. `entrypoints/`는 진입점, `utils/`는 DOM 유틸리티, `tests/`와 `e2e/`는 테스트, `assets/`와 `public/`은 정적 자산.
- `apps/web/`: Next.js 소개 사이트. `app/`에 페이지·스타일, `public/`에 정적 자산을 둔다.
- `docs/`: 설계 문서를 둔다.
- `packages/`: 공용 프로토콜과 native host를 위한 예정 경로이며 아직 구현하지 않았다.

## 개발 명령어

Node는 `.nvmrc`, pnpm은 `package.json`의 `packageManager` 버전을 사용한다. 저장소 루트에서 실행한다.

- `nvm install && nvm use`, `pnpm install`: 개발 환경·의존성·Git 훅 설치.
- `pnpm dev:ext` / `pnpm dev:web`: 확장 / 웹 개발 서버 실행.
- `pnpm build`: 전체 앱 빌드.
- `pnpm typecheck`: 타입 검사.
- `pnpm lint` / `pnpm format:check`: 린트 / 포맷 검사.
- `pnpm lint:fix` / `pnpm format`: 자동 수정 후 변경 사항 확인.
- `pnpm test`: Chromium에서 Vitest 실행.
- `pnpm test:e2e`: 확장 빌드 후 Playwright 실행.

최초 테스트 전 `pnpm --filter @opener/extension exec playwright install chromium`을 실행한다.

## 코드 스타일

TypeScript와 ES 모듈을 사용한다. Prettier 기준은 공백 2칸, 세미콜론, 큰따옴표, 후행 쉼표, 줄 너비 100이다. 컴포넌트는 PascalCase, 함수는 camelCase, 유틸리티 파일은 kebab-case로 작성한다. 확장은 명시적 import를 사용하며 WXT 자동 import와 `#imports`는 사용하지 않는다. Promise는 ESLint 규칙에 맞게 처리한다.

### 타입스크립트

- Non-null 단언 연산자를 지양한다. 단,테스트에서 직접 만든 요소를 바로 찾는 경우에는 일부 허용한다.
- 타입 단언을 지양한다. 실제로 확인해서 타입을 좁히는 방법을 사용한다.
- `let` 사용을 지양한다. 재할당하지 않는 값은 `const`로 선언한다. 반복문 카운터나 실제 상태 변경처럼 재할당이 필요한 경우에만 `let`을 사용한다.
- 객체 모양은 `interface`로 정의하고 union·함수·mapped type은 `type`을 우선한다.
- 널 아님 단언 연산자를 지양한다. 단, 테스트에서 직접 만든 요소를 바로 찾는 경우에는 일부 허용한다.
- 순서대로 진행하는 비동기 코드는 `async`/`await`을 우선한다. 반환 형태를 맞추기 위해 `Promise.resolve()`나 `Promise.reject()`를 만들거나 하지 않는다.

## 테스트

동작 변경은 **실패 테스트 확인 → 최소 구현 → 통과 후 리팩터링** 순서를 따른다. 문서만 바꾸는 작업은 제외한다. 단위 테스트는 `tests/**/*.test.ts`, E2E는 `e2e/**/*.spec.ts`에 작성한다. DOM·레이아웃은 실제 Chromium에서 검증하고 E2E는 확장 통합 흐름에 집중한다. 커버리지 수치 기준은 없다. CI는 포맷·린트·타입·빌드·단위 테스트·E2E를 검사한다.

### 동작 중심으로 테스트한다

- 반환값, DOM 결과, 사용자에게 보이는 상태, 필요한 확장 API 상호작용, 정리 작업처럼 관찰 가능한 동작을 검증한다.
- 비공개 상태나 구현 세부사항은 테스트하지 않는다. 호출 횟수·순서는 계약의 일부일 때만 검증한다.
- 테스트를 위해 프로덕션 코드의 함수나 타입을 밖으로 노출하지 않는다. 공개 진입점(예: `collectTextForTranslation`)으로 검증한다.

### 각 테스트를 독립적이고 명확하게 작성한다

- 실행 순서나 다른 테스트가 만든 상태에 의존하지 않는다. 모듈 스코프의 변경 가능한 상태 대신 테스트별 상태를 쓴다.
- 준비(`mount`), 실행, 검증을 드러낸다. 테스트 하나는 시나리오 하나를 설명한다.

### 설정과 정리

- 공통 설정·정리는 `tests/setup.ts`가 맡는다.
- 동작에 영향을 주는 설정은 `beforeEach`에 숨기지 않고 각 테스트 안에 둔다.
- `setup.ts`가 복구하지 않는 것(spy, `vi.stubGlobal`, `document.head`, `documentElement` 속성 등)을 바꿨다면 그 테스트 파일의 `afterEach`에서 되돌린다.

### 실제 브라우저를 우선하고 test double은 최소로

- 단위 테스트가 실제 Chromium에서 돌기 때문에 레이아웃, `getComputedStyle`, `ResizeObserver`, `IntersectionObserver` 같은 브라우저 API는 모킹하지 않고 실제로 쓴다.
- 확장 API는 직접 mock하지 않고 `fakeBrowser`를 쓴다. 필요한 초기 상태만 테스트 안에서 채운다.
- 그 밖의 외부 경계만 mock한다. 상태를 가진 stub·spy가 필요하면 모듈 전역 변수 대신 테스트마다 호출하는 팩토리 함수로 감싼다.
- 시간은 `vi.useFakeTimers()`로 통제한다. 고정 지연, 실제 네트워크, 통제되지 않은 난수에 의존하지 않는다.

### 테스트 계층을 나눈다

- DOM 탐색, 수집, 계산 로직: 단위 테스트에서 세부 조건까지 검증한다.
- 확장 통합 흐름(content script 주입, background와의 메시지 등): E2E에서 주요 흐름만 검증하고 단위 테스트의 세부 조건을 반복하지 않는다.
- 중복 테스트를 지울 때는 기존에 확인하던 동작이 사라지지 않는지 확인하고, 필요한 검증은 더 알맞은 계층으로 옮긴다.

### E2E 작성 규칙

- 접근 가능한 이름 기반 locator(`getByRole` 등)와 자동 재시도 assertion(`await expect(...).toBeVisible()`)을 쓴다.
- 확장이 남기는 이벤트를 기다릴 때는 `Promise.all`로 대기를 먼저 걸고 동작을 실행해 이벤트를 놓치지 않는다. 확장 출처는 `extensionId`로 구분한다.
- `pnpm test:e2e`가 확장을 빌드한 뒤 실행한다.
- `test-results/`, `playwright-report/`는 커밋하지 않는다.

## Git 작업

- NEVER run `git add`, `git commit`, or `git push`.

### 브랜치 전략

- 같은 기능의 구현, 테스트, 리팩터링, 문서는 하나의 기능 브랜치에서 작업한다.
- task가 바뀌거나 작업 종류가 달라져도 새 브랜치를 만들지 않는다.
- 브랜치 생성·전환·이름 변경·삭제는 사용자가 명시적으로 요청한 경우에만 수행한다.
- 다른 브랜치가 필요하다고 판단하면 이유를 설명하고 먼저 제안한다.
- 브랜치 이름은 `<타입>/<기능>` 형식을 사용한다. 예: `feat/text-collection`.

### 커밋

- Git commit은 항상 사용자가 직접 수행한다.
- 변경이 끝나면 Conventional Commit 형식의 커밋 메시지를 추천한다. 메세지를 추천할 때는 변경 의도(왜)가 잘 드러나도록 작성한다. 간략한 커밋 제목과 내용은 불렛포인트로 간결하게 작성한다. Conventional Commits를 따르며 설명은 기존 이력처럼 한국어로 작성한다. 예: `fix(extension): 텍스트 수집 오류 수정`. 변경 의도와 이유를 중점으로 아래와 같이 세부 사항을 불렛포인트로 추가할 수 있다.

```
docs: plan.md 및 research.md 문서 보안

- `translate` 및 요소 가시성 판단 기준에 대한 세부 사항 추가
- `TreeWalker`를 활용한 탐색 방식에서 제외 조건 및 자식 요소 재허용 규칙 명확화
```

### PR

- PR은 `.github/pull_request_template.md`에 맞춰 변경 요약, 관련 이슈(`Closes #123`), 구현 근거와 검증 결과를 적는다.

## 작업 원칙

웹 코드 수정 전 `apps/web/AGENTS.md`와 설치된 Next.js의 관련 문서를 읽는다.
