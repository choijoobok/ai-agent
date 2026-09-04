# `documents/screen/` — 화면 문서 셋

화면 하나 = 문서 **셋**. 규칙은 [`CLAUDE.md` §5](../../CLAUDE.md) 가 갖고, **형식은 이 폴더의 템플릿이** 갖는다.

```
documents/screen/{페이지경로}/
    requirements.md      개발 요건 정의서 — AI 가 읽고 구현한다
    mockup.html          목업 + 테스트케이스 — 설계자가 보고 확인한다
    manual.md            사용자 메뉴얼 — 원본
    manual.html          〃 파생 — `/manual-site` 가 생성한다. 손으로 고치지 않는다
    screen.png           (선택) 실제 화면 캡처 — 있으면 메뉴얼이 목업 그림 대신 이것을 쓴다
    impl.md              (선택) 구현 기록 — 만든 파일과 요건서 대비 이탈
```

## 셋은 독자가 다르다

| 문서 | 독자 | 무엇을 적나 | 무엇을 적지 않나 |
|---|---|---|---|
| `requirements.md` | **AI** | *무엇을* — 컬럼 · 조건 · 버튼 · 검증 · 상태 전이 · 영향 테이블. **DB 컬럼 · 코드그룹 · 메시지 키는 명시** | *어떻게* — 컴포넌트 · prop · 함수명. 이미 표준인 공통 동작 |
| `mockup.html` | **설계자** | 배치와 **상태별 화면**, **테스트케이스**(되면 안 되는 것 포함) | 구현 코드 · 실제 데이터 |
| `manual.md` | **운영자** | 할 수 있는 일을 **순서대로**, **다른 메뉴와의 관계**, 안 될 때 | 테이블 · API · 코드값 · 권한 이름 |

같은 사실을 셋에 세 번 적지 않는다 — **요건서가 규칙의 정본**이고, 목업은 그것이 지켜졌는지 묻고, 메뉴얼은 그것을 사용자의 말로 옮긴다.

## 새 화면을 시작할 때

```bash
cp -r documents/screen/_TEMPLATE documents/screen/{페이지경로}
```

순서와 대조 방법은 `/menu-doc` 이 갖는다 — 어느 화면이 문서 셋을 갖췄는지는
`node .claude/skills/menu-doc/screens.mjs` 가 센다.

1. `requirements.md` 와 `mockup.html` 을 **함께** 만들어 **사용자 승인을 받는다.**
   승인 전 BE/FE/시드 착수 금지 — 승인은 *둘을 함께* 보는 판단이라, 요건서만 승인받고
   목업에서 뒤집히면 그 승인이 무효가 된다(`CLAUDE.md` §5.3 ①·②·③).
2. 승인 뒤 구현하면서 `manual.md` 를 만든다(같은 §5.3 ④). **화면이 서기 전의 사용법은
   추측이고, 추측한 메뉴얼은 고칠 곳을 알려 주지 않는다.**
   **셋 중 하나만 있는 상태로 커밋하지 않는다.**
3. `manual.html` 은 `/manual-site` 가 만든다 — `node .claude/skills/manual-site/build.mjs`.
   같은 명령이 [`index.html`](./index.html)(좌측 실제 메뉴 트리 + 중앙 메뉴얼)과
   **고객사 제출 폴더**(`build/manual/` — 형상 관리 밖)를 함께 만든다.

## 폴더 이름은 페이지 경로다

`sources/frontend/src/shared/routes/screenRegistry.ts` 의 키를 그대로 미러링한다 — `/log/access` → `documents/screen/log/access/`.
**경로를 바꾸면 폴더도 같은 커밋에서 `git mv` 한다.** 메뉴 트리(`menu-tree.yaml` 의 위치)는 운영 중에 옮겨질 수 있으므로 폴더 기준이 아니다.

`_` 로 시작하는 폴더는 문서 대상이 아니다(`_TEMPLATE`). 페이지 경로는 `_` 로 시작하지 않는다.

## 현행화

**소스가 바뀌면 그 화면의 셋을 즉시 대조하고, 소스와 문서를 같은 커밋에 담는다.** 나누면 그 사이의 커밋이 거짓말을 한다.
대조 사슬은 `CLAUDE.md` §5.5 에 있다.
