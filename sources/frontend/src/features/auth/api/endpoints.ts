/**
 * 인증 API 경로 — security-design.md §3.
 *
 * <p>호출 URL 은 이 파일에만 둔다(frontend-stack.md §9). 화면이 문자열을 직접 쓰면 ESLint 가 막는다 —
 * 이 선언이 `SYS_MENU_API` 시드의 입력이므로 <b>선언 = 사용</b>이 구조적으로 보장돼야 한다.
 *
 * <p>`baseURL` 이 `/api` 이므로 여기서는 그 다음 마디부터 적는다. 첫 마디가 계층이며
 * (`public` · `common` · `service`) 그것이 접근 정책을 정한다(security-design.md §4 · api-conventions.md §2.1).
 *
 * <p>`public`·`common` 은 인가 판정을 받지 않으므로 시드 대상이 아니다(60 §3.4).
 */
export const AUTH_ENDPOINTS = {
  login: '/public/auth/login',
  getMe: '/common/auth/getMe',
  heartbeat: '/common/auth/heartbeat',
  logout: '/common/auth/logout',

  /*
    분실 비밀번호 재설정 — AUTH-07 · documents/screen/_standalone/login/requirements.md §7.

    **셋을 `reset` 으로 묶은 것이 결정이다.** 한 묶음임이 경로만 봐도 보이고, 이미 있는
    `/service/user/savePasswordReset`(관리자 임시 비밀번호 발급)과 이름이 겹치지 않는다 —
    둘은 다른 일이며 겹치면 로그에서 구분되지 않는다.

    **정책만 GET 이다** — `common`·`public` 의 조회는 GET, 나머지는 POST(api-conventions.md §2.1).
  */
  getPasswordPolicy: '/public/auth/getPasswordPolicy',
  sendResetCode: '/public/auth/sendResetCode',
  verifyResetCode: '/public/auth/verifyResetCode',
  saveResetPassword: '/public/auth/saveResetPassword',
} as const;
