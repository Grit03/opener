# Native host

Node.js 표준 모듈로 native messaging 요청을 읽고 Claude 또는 Codex CLI를 실행한다. CLI별 어댑터는 인자 구성과 결과 추출을 맡고, 세그먼트 ID 검증은 공통으로 처리한다.

## 실행과 검증

저장소 루트에서 `pnpm install`을 실행한다. 사용자는 Node.js 22.18 이상과 사용할 AI CLI를 별도로 설치한다. 개발 버전은 저장소의 `.nvmrc`를 따른다. Node의 기본 TypeScript 지원으로 소스를 직접 실행하며, 타입 검사는 `tsc --noEmit`으로 별도 실행한다.

```bash
pnpm --filter @opener/native-host typecheck
pnpm --filter @opener/native-host start
pnpm test --project native-host
```

별도 빌드나 `dist/` 산출물은 없다. 실행하려면 `packages/native-host`, `packages/protocol` 소스와 `pnpm install`로 연결한 workspace 의존성이 필요하다. CLI가 읽는 `src/translation-result.schema.json`도 함께 유지한다. 루트의 `pnpm typecheck`에 호스트가 포함된다.

입력과 출력은 JSON 앞에 네이티브 바이트 순서의 4바이트 길이 헤더를 붙인 바이너리 스트림이다. 일반 JSON 한 줄을 stdin에 넣는 방식은 지원하지 않는다. stdout에는 프로토콜 메시지만 쓰며, 호스트의 진단 로그는 stderr에 기록한다.

요청 본문 예시:

```json
{
  "type": "translate.request",
  "provider": "claude",
  "targetLanguage": "ko",
  "segments": [{ "id": "title", "text": "Hello" }]
}
```

`provider`는 `claude` 또는 `codex`다. 성공 응답에는 `translate.result` 타입과 `translations` 배열을 담는다. 번역 실패 응답에는 `translate.error` 타입과 `code`, `message`를 담는다.

## 동작 범위

- CLI는 기존 로그인과 부모 프로세스의 환경 변수를 사용한다. 브라우저가 실행한 환경에서도 `node`, `claude`, `codex`를 PATH로 찾을 수 있어야 한다.
- Claude는 `haiku`, Codex는 CLI의 기본 모델을 사용한다. CLI별 설정은 `src/claude.ts`, `src/codex.ts`에 모았다.
- 요청마다 빈 임시 작업 디렉터리를 만들고 종료 후 삭제한다. 원문은 stdin으로 전달하며 세션 저장을 끈다. 이는 AI 서비스 측의 데이터 보관까지 제어한다는 뜻은 아니다.
- Claude는 도구와 사용자 커스터마이징을 끈다. Codex는 사용자 설정, 셸 도구, 웹 검색, 앱, 플러그인, 훅, 서브에이전트를 끄고 읽기 전용 샌드박스를 사용한다. Codex의 모든 기본 도구가 제거된다는 보장은 하지 않는다.
- CLI 제한 시간은 120초, stdout/stderr 한도는 각각 1 MiB다. 브라우저 연결 종료나 host의 종료 신호를 실행 중인 번역 취소로 전달하는 처리는 아직 구현하지 않았다.
- 메시지 본문은 양방향 1 MiB로 제한한다. `NativeHost`는 요청 타입별 핸들러를 병렬 호출하고, `main.ts`의 번역 핸들러가 동시 번역을 최대 4개로 제한한다. 초과 요청에는 `BUSY`를 반환한다.
- 호스트는 요청 타입을 확인한다. 번역 요청의 필수 필드·provider·세그먼트 검증과 번역 실패 응답의 내부 상세 정보 숨김은 아직 구현하지 않았다.
- 옵션은 Claude Code 2.1.258, Codex CLI 0.154.0의 도움말을 기준으로 구성했다. 다른 버전의 호환성과 실제 모델 응답은 별도 검증이 필요하다. 자동 재시도는 하지 않는다.

CLI 옵션 근거: [Claude CLI reference](https://code.claude.com/docs/en/cli-reference), [공식 OpenAI 설정 문서](https://developers.openai.com/codex/config-reference).

브라우저 연결에는 `com.opener.native_host` manifest 등록이 별도로 필요하다. macOS/Linux에서는 실행 권한이 있는 `src/main.ts`의 절대 경로를 manifest의 `path`로 지정하고, `allowed_origins`에 자신의 확장 ID만 등록한다. Windows용 실행 래퍼, 설치 자동화, background 연결은 이 구현에 포함하지 않는다.

테스트는 Vitest의 Node 환경에서 실행한다. 요청 타입·번역 결과 검증, 메시지 프레임, 호스트 처리는 각 단위 테스트 파일에서 검증한다. `tests/cli.integration.test.ts`는 자식 프로세스 실행과 CLI별 요청·응답을 검증한다. `tests/main.integration.test.ts`는 실제 `src/main.ts`와 가짜 CLI를 실행해 동시 번역 제한과 성공·실패 후 다음 요청 처리를 검증한다. 가짜 CLI의 완료 시점은 로컬 Unix 소켓으로 제어하며, 실제 AI 서비스는 호출하지 않는다.

`pnpm test --project native-host`는 두 종류를 모두 실행한다. 프로세스 통합 테스트만 실행하려면 `pnpm test --project native-host .integration`을 사용한다. CLI 제한 시간은 실제 프로세스 경계의 동작이므로 통합 테스트에서 실제 타이머로 검증한다. `fake-cli.mjs`는 별도 Node 프로세스에서 실행되므로 검증에 Node의 `assert`를 사용한다.
