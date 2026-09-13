---
name: manual-site
description: 화면별 manual.md를 사용자 매뉴얼 오프라인 사이트로 조립하고 목업·실제 캡처 치환 상태를 검사한다. 메뉴얼을 고친 뒤, 사용자 메뉴얼 HTML을 만들 때, 실제 화면을 캡처해 넣을 때 쓴다. "메뉴얼 HTML" · "메뉴얼 사이트" · "화면 캡처" 요청에 쓴다.
---

# 사용자 매뉴얼 사이트

`documents/screen/{페이지경로}/manual.md`가 정본이다. 화면별 `manual.html`을 만들지 않고
`build/deliverables/user/index.html` 하나만 생성한다. 세 고객 제출 사이트 전체를 만들 때는
`/deliverable-site`를 사용한다.

## 그림 자리와 파일명

`manual.md`에서 다음처럼 그림의 의미 키를 선언한다.

```markdown
[활성 세션 탭](./mockup.html#tab-session)
```

같은 키는 목업의 `id`와 `data-manual`에 함께 둔다.

```html
<section id="tab-session" data-manual="tab-session">...</section>
```

사이트 빌더가 같은 폴더에서 실제 캡처를 찾는다.

- `main` → `screen.png`
- 그 밖의 키 → `screen-{키}.png` (예: `screen-tab-session.png`)

파일명을 Markdown에 직접 쓰지 않는다. 따라서 목업과 캡처를 바꿔도 `manual.md`는 바뀌지 않는다.
검토본에는 화면 ID(SCR), 그림 키, 기대 캡처 경로가 표시된다.

## 생성과 검사

```bash
node .claude/skills/mockup/scaffold.mjs --check
node .claude/skills/manual-site/build.mjs
node .claude/skills/deliverable-site/build.mjs user --release
```

- 기본 검토본은 PNG가 없으면 목업을 쓴다.
- `--release`는 그림 자리마다 실제 PNG를 요구한다. 하나라도 없으면 실패한다.
- 결과는 `build/deliverables/` 파생물이므로 커밋하지 않는다.
- PDF는 사이트의 `전체 인쇄·PDF` 버튼을 쓰거나 `/deliverable-site --pdf`로 만든다.

## 실제 화면 캡처

자동 대표 화면 캡처는 앱과 테스트 계정·데이터가 준비된 환경에서만 실행한다.

```bash
npm i -D playwright
npx playwright install chromium
node .claude/skills/manual-site/capture.mjs --id=<계정> --pw=<비밀번호>
```

자동 캡처는 실제 웹 앱에 로그인하고 각 메뉴 URL을 열어 대표 화면 `screen.png`를 저장한다.
탭·모달·조회 결과처럼 상호작용이 필요한 그림은 사람이 해당 상태를 만든 뒤
`screen-{키}.png`로 저장한다. 계정은 인자나 `MANUAL_CAPTURE_ID`·`MANUAL_CAPTURE_PW`로만
전달하고 저장소에 기록하지 않는다.

## 고치지 않는 것

- `build/deliverables/**`를 직접 고치지 않는다.
- 내용은 `manual.md`, 화면 규칙은 `requirements.md`, 목업 그림은 `/mockup`으로 고친다.
- 사이트 모양은 `aidd-guide/artifact/site-kit/assets/`에서 고친다.

## 파일

```text
.claude/skills/manual-site/
    build.mjs        /deliverable-site user 호환 진입점
    capture.mjs      실제 대표 화면 캡처(선택)
    lib/menu.mjs     실제 메뉴 트리와 화면 문서 매핑
    lib/markdown.mjs Markdown 렌더링과 그림 자리 문법
    lib/figure.mjs   목업 블록과 캡처 PNG 선택
```
