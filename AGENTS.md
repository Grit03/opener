# Repository Guidelines

## 프로젝트 구조

- `apps/extension/`: WXT + React 확장. `entrypoints/`는 진입점, `utils/`는 DOM 유틸리티, `tests/`와 `e2e/`는 테스트, `assets/`와 `public/`은 정적 자산.
- `apps/web/`: Next.js 소개 사이트. `app/`에 페이지·스타일, `public/`에 정적 자산을 둔다.
- `specs/<번호>-<기능>/`: 명세·계획·작업 목록. `docs/`에는 설계 문서를 둔다.
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

## 테스트

동작 변경은 **실패 테스트 확인 → 최소 구현 → 통과 후 리팩터링** 순서를 따른다. 문서만 바꾸는 작업은 제외한다. 단위 테스트는 `tests/**/*.test.ts`, E2E는 `e2e/**/*.spec.ts`에 작성한다. DOM·레이아웃은 실제 Chromium에서 검증하고 E2E는 확장 통합 흐름에 집중한다. 커버리지 수치 기준은 없다. CI는 포맷·린트·타입·빌드·단위 테스트·E2E를 검사한다.

## Git 작업

- NEVER run `git add`, `git commit`, or `git push`.

### 새로운 작업 진행 전 브랜치 전략

- 새로운 작업을 하기 전에 짧고 명료한 브랜치를 영어로 생성하고 진행한다.
- 브랜치명은 작업하려는 spec에서 숫자 부분을 빼고 `<타입>/<기능>` 식으로 작성한다. (예: `feat/text-collection`)
- 매번 기능은 `specs/` 폴더에 기능 명세가 정해져 있는 것 기반으로 작업한다.

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

`.specify/memory/constitution.md`를 따르고 명세 범위를 지킨다. 범위 변경 시 명세·계획부터 갱신한다. 웹 코드 수정 전 `apps/web/AGENTS.md`와 설치된 Next.js의 관련 문서를 읽는다.

### Spec Kit 기반 SDD (개발 방식)

- 기본적으로 한 번에 하나의 task만 구현한다.
- 현재 task가 완료되면 다음 task를 시작하지 말고 STOP한다.
- 완료된 task는 `tasks.md`에서 체크한다.
- task 완료 후 다음 내용을 보고한다:
  - 변경된 파일
  - 구현 내용
  - 테스트 결과
  - 추천 커밋 메시지 (메세지는 위 [커밋 전략](#커밋) 참고)
