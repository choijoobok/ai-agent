---
name: deliverable-site
description: 설계 산출물·사용자 매뉴얼·운영 런북/개발자 가이드를 좌측 트리형 오프라인 HTML 사이트와 선택 PDF로 조립한다. "고객 제출본", "산출물 사이트", "모든 문서를 HTML", "오프라인 매뉴얼", "PDF 제출본" 요청에 사용한다.
---

# 고객 제출 사이트 생성

정본을 옮기거나 HTML을 손으로 고치지 않는다. `documents/delivery.yaml`의 세 사이트 구성을 읽고
`build/deliverables/`를 통째로 다시 만든다.

```bash
node .claude/skills/doc-gen/gen.mjs
node .claude/skills/runbook/check.mjs
node .claude/skills/deliverable-site/build.mjs all
node .claude/skills/deliverable-site/check.mjs
node .claude/skills/deliverable-site/build.mjs design
node .claude/skills/deliverable-site/build.mjs user
node .claude/skills/deliverable-site/build.mjs operations
node .claude/skills/deliverable-site/build.mjs all --release
node .claude/skills/deliverable-site/build.mjs all --release --pdf
```

문서 생성과 사이트 조립은 의도적으로 분리한다. 첫 명령이 정본에서 `documents/generated/`를
갱신하고, 사이트 빌더는 그 결과를 읽기만 한다. 사용자 사이트만 확인할 때는 첫 명령을 생략할 수 있다.

## 모드

- 기본 검토 모드: 목업을 허용하고 화면마다 SCR ID·그림 키·대체 파일 경로를 표시한다.
- `--release`: 고객에게 보일 검토 표식을 제거하고, 사용자 매뉴얼의 그림이 실제 PNG가 아니면 실패한다.
- `--pdf`: Playwright가 있으면 각 사이트 전체를 PDF로 만든다. 없으면 HTML은 유지하고 PDF 실패를 보고한다.

## 입력 경계

- 설계: `documents/generated/**/*.md`(운영 런북 제외), `documents/design/**/*.md`,
  `documents/screen/**/requirements.md` + `mockup.html`.
- 사용자: 메뉴가 있는 화면의 `manual.md` + 같은 화면의 목업/캡처.
- 운영: `documents/generated/80-운영런북.md` + `developer-guide/**/*.md`.

`manual.md`의 `[설명](./mockup.html#키)`가 그림 자리다. 같은 폴더의 `screen.png` 또는
`screen-{키}.png`가 있으면 목업보다 우선한다. 파일명을 HTML에 직접 쓰지 않는다.

UI 자산은 `aidd-guide/artifact/site-kit/assets/` 한 벌을 세 사이트가 공유한다. 입력 Markdown과
목업은 원래 자리에서 계속 개발하며 제출 폴더로 복사하거나 이동하지 않는다.

## 완료 판정

생성된 `delivery-manifest.json`에서 문제를 먼저 보고한다. `--release` 실패를 경고로 낮추지 않는다.
`check.mjs`로 본문-목차 수와 모든 로컬 CSS·JS·이미지 경로를 검사한다.
제출물은 `build/` 파생물이므로 커밋하지 않는다. P6에서는 폴더 전체와 선택 PDF를 인수 대상으로 삼는다.
