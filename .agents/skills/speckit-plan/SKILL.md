---
name: speckit-plan
description: 요청할 때만 research.md를 추가로 작성한다.
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: github-spec-kit
  source: preset:optional-research
---

# Speckit Plan Skill

## User Input

```text
$ARGUMENTS
```

## Outline

1. Read `.specify/feature.json` to get the feature directory path.

2. **Load context**: `.specify/memory/constitution.md` and `<feature_directory>/spec.md`.

3. Create an implementation plan and store it in `<feature_directory>/plan.md`.
   - Technical context: tech stack, dependencies, project structure
   - Design decisions, architecture, file structure



## 선택적 조사

`$ARGUMENTS`에 `--research`가 포함된 경우에만 다음 작업을 수행한다.

1. 명세와 구현 계획에서 근거가 필요한 기술 결정을 찾는다.
2. 웹 표준과 공식 문서를 우선 조사한다.
3. `<feature_directory>/research.md`를 작성한다.
4. 각 조사 항목은 다음 형식을 사용한다.

   - 결정
   - 근거
   - 검토한 대안
   - 출처

5. 조사 결과를 `plan.md`의 기술 결정에 반영한다.
6. 외부 오픈소스 코드는 복사하거나 발췌하지 않는다.
7. `--research` 자체는 기능 요구사항으로 취급하지 않는다.

`--research`가 없으면 `research.md`를 새로 만들거나 수정하지 않는다.
