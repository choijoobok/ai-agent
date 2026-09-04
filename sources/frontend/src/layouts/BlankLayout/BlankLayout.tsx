import type { ReactNode } from 'react';

/**
 * 셸 밖의 화면 — 로그인 · 비밀번호 강제 변경 등(frontend-stack.md §2 · 60 §1).
 *
 * <p>헤더·사이더·탭바가 없다. 메뉴를 갖지 않는 화면들이므로 셸에 얹을 것이 없고,
 * 인증 전이라 권한 메뉴를 아직 모른다.
 */
export function BlankLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>{children}</div>
    </div>
  );
}
