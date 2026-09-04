# `documents/screen/_standalone/` — 메뉴를 갖지 않는 화면 여덟

`SYS_MENU` 에 행이 없지만 **화면은 존재한다.** 셸에 들어가기 전이거나 셸의 모달이다.
규칙은 [`CLAUDE.md` §5](../../../CLAUDE.md) 가 갖고 형식은 [`documents/screen/_TEMPLATE/`](../_TEMPLATE) 가 갖는다 — **여기서 재정의하지 않는다.**

```
documents/screen/_standalone/{화면}/
    requirements.md      개발 요건 정의서
    mockup.html          목업 + 테스트케이스
```

## `documents/screen/` 와 무엇이 다른가

| | `documents/screen/` | 여기 |
|---|---|---|
| 폴더 이름 | **페이지 경로**(`screenRegistry.ts` 의 키) | **화면 이름** — 경로가 없거나 모달이라 붙일 것이 없다 |
| `MENU_CD` | 있다 | **없다** |
| 액션 권한 `(MENU_CD, ACTION_CD)` | 판정한다 | **판정하지 않는다 — 걸 자리가 없다** |
| API 접두 | `/api/service/**` | **`/api/public/**`**(인증 전) 또는 **`/api/common/**`**(인증만) |
| `X-Menu-Code` 헤더 | 매 요청 부착 | **생략**한다 |
| 인가 시드 | `endpoints.ts` 가 `generateApiSeed` 의 입력 | **입력이 아니다** — `common`·`public` 은 스캔 대상이 아니다 |
| `manual.md` | 있다 | **없다** — 사용자 메뉴얼은 메뉴 단위로 엮인다 |

> **권한을 걸 수 없다는 것이 설계 제약이다.** 모달에 담은 기능은 **전 사용자에게 열린다.**
> 관리자만 써야 하는 것은 모달이 아니라 **메뉴여야 한다** — 알림 요청이 *사용자는 모달,
> 관리자는 메뉴* 로 갈린 이유가 그것이다.

## 여덟

| 화면 | 실물 | 자리 |
|---|---|---|
| [login](./login) | `features/auth/pages/LoginPage.tsx` · `components/PasswordResetFlow.tsx` | `/login` · 셸 밖 |
| [pwd-change](./pwd-change) | (Phase 5) | `/password/change` · 셸 밖 |
| [session-expire](./session-expire) | `features/auth/components/ExpiryWarningModal.tsx` · `ReauthModal.tsx` | 셸 위 모달 |
| [profile](./profile) | `features/profile/ProfileModal.tsx` | 헤더 → 모달 |
| [settings](./settings) | `features/settings/SettingsModal.tsx` | 헤더 → 모달 |
| [noti-inbox](./noti-inbox) | `features/notification/NotificationModal.tsx` | 헤더 벨 → 모달 |
| [notice-popup](./notice-popup) | `features/notification/NoticePopupModal.tsx` | 셸 부팅 후 |
| [menu-modal](./menu-modal) | `layouts/ShellLayout/MenuEntryModal.tsx` (+ `shared/authz/menuSearch` · `shared/favorite/`) | 헤더 → 모달 |

## 어디서 왔나

`docs/design/60-screen-auth.md` 와 `docs/design/mockups/` 가 갖고 있었다. 그 폴더가
폐지되면서(2026-09-04) **여덟이 문서를 통째로 잃을 자리였다** — `documents/screen/` 는 페이지
경로로 미러링하는데 이 화면들에는 그 경로가 없기 때문이다.

## 현행화

**소스가 바뀌면 그 화면의 둘을 즉시 대조하고, 소스와 문서를 같은 커밋에 담는다.**
`doc-drift` 훅은 `screenRegistry` 를 축으로 계산하므로 **여기까지 오지 않는다** — 사람과 AI 가 본다.
