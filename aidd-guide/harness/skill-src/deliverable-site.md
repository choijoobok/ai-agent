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
node .claude/skills/deliverable-site/build.mjs user --release --standalone
node .claude/skills/deliverable-site/browser-check.mjs design
```

문서 생성과 사이트 조립은 의도적으로 분리한다. 첫 명령이 정본에서 `documents/generated/`를
갱신하고, 사이트 빌더는 그 결과를 읽기만 한다. 사용자 사이트만 확인할 때는 첫 명령을 생략할 수 있다.

## 모드

- 기본 검토 모드: 목업을 허용하고 화면마다 SCR ID·그림 키·대체 파일 경로를 표시한다.
- `--release`: 고객에게 보일 검토 표식을 제거하고, 사용자 매뉴얼의 그림이 실제 PNG가 아니면 실패한다.
- `--standalone`: 선택한 사이트만 `build/deliverables-{대상}/`에 물리적으로 분리한다. 일반 사용자에게는 `user --release --standalone`으로 만든 `build/deliverables-user/`만 전달한다. 이 폴더에는 설계·운영 사이트가 없다.
- `--pdf`: Playwright가 있으면 `pdf/{사이트}/` 아래에 **문서별 PDF**를 만든다. Mermaid가 SVG로 끝날 때까지 기다린 뒤 출력한다. 없으면 HTML은 유지하고 PDF 실패를 보고한다.

최초 PDF 생성 환경은 `sources/frontend/`에서 `npm install`로 잠긴 의존성을 설치하고
`npx playwright install chromium`을 한 번 실행한다. 고객 제출 폴더에는 브라우저나 Node 모듈을 복사하지 않는다.

## 입력 경계

- 설계: `documents/generated/**/*.md`(운영 런북 제외), `documents/design/**/*.md`,
  `documents/screen/**/requirements.md` + `mockup.html`.
- 사용자: 메뉴가 있는 화면의 `manual.md` + 같은 화면의 목업/캡처.
- 운영: `documents/generated/80-운영런북.md` + `developer-guide/**/*.md`.

`manual.md`의 `[설명](./mockup.html#키)`가 그림 자리다. 같은 폴더의 `screen.png` 또는
`screen-{키}.png`가 있으면 목업보다 우선한다. 파일명을 HTML에 직접 쓰지 않는다.

UI 자산은 `aidd-guide/artifact/site-kit/assets/` 한 벌을 세 사이트가 공유한다. 입력 Markdown과
목업은 원래 자리에서 계속 개발하며 제출 폴더로 복사하거나 이동하지 않는다.

설계 사이트의 화면 목차는 메뉴 CSV의 실제 부모·자식 순서와 한글명을 그대로 쓴다. `/sample/**` 화면은
검토본·제출본 모두 제외한다. 목업 탭에는 화면만 오린 그림이 아니라 번호 배지 설명·테스트 케이스를
포함한 `mockup.html` 전체 본문을 싣는다.

사이트는 오프라인 `mermaid.min.js`를 함께 넣어 `mermaid` 코드 펜스를 SVG로 렌더링한다. 상단에는
현재 문서 경로와 보기 설정(100% 너비·글꼴·글자 크기)을 두며, 인쇄 버튼은 현재 문서만 인쇄한다.

## 완료 판정

생성된 `delivery-manifest.json`에서 문제를 먼저 보고한다. `--release` 실패를 경고로 낮추지 않는다.
`check.mjs`로 본문-목차 수와 모든 로컬 CSS·JS·이미지 경로를 검사한다.
`browser-check.mjs`로 현재 문서 하나만 인쇄되는지, 보기 설정·현재 경로·상세 목업·Mermaid SVG가 실제 Chromium에서도 동작하는지 검사한다.
제출물은 `build/` 파생물이므로 커밋하지 않는다. P6에서는 폴더 전체와 선택 PDF를 인수 대상으로 삼는다.
