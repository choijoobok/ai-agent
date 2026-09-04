package com.ordinary.backoffice.core.error;

/**
 * 에러가 어떤 HTTP 상태로 나가는지. 코드마다 숫자를 적지 않고 이 넷 중 하나를 고른다.
 *
 * <p>목록은 api-conventions.md §2.3 의 상태 코드 표와 1:1 이다 — 200 은 여기 없다(성공은 에러가 아니다).
 */
public enum ErrorType {

    /** 검증 실패 · 조회조건 위반. 폼이 필드별 오류를 표시한다. */
    INVALID_REQUEST(400),

    /** 세션 만료. 프론트는 재인증 모달을 띄우고 로그아웃하지 않는다(frontend-stack.md §9). */
    UNAUTHENTICATED(401),

    /** 인가 거부. {@code code} 가 갈래를 나른다(security-design.md §4). */
    FORBIDDEN(403),

    /** 그 밖. 스택트레이스를 응답에 담지 않는다 — {@code traceId} 만 준다(security-design.md §8). */
    INTERNAL_ERROR(500);

    private final int status;

    ErrorType(int status) {
        this.status = status;
    }

    public int status() {
        return status;
    }
}
