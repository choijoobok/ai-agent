// @feat FEAT-502
package com.aiagent.api.authz;

import com.aiagent.domain.authz.EffectiveAuthority;
import jakarta.servlet.http.HttpSession;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

/**
 * 유효 권한과 계산 전에 관측한 무효화 표식을 한 세션 속성에 저장한다.
 *
 * <p>계산 요청은 무효화 표식을 지우거나 덮어쓰지 않는다. 다른 요청의 회수가 먼저 저장돼도
 * 늦은 계산 결과와 표식이 불일치하므로 다음 요청에서 다시 계산한다. Spring Session 저장은
 * ON_SET_ATTRIBUTE를 사용한다 — 읽기만 한 표식까지 다시 저장하면 이 경계를 잃는다.
 */
public final class AuthzSession {

    static final String AUTHORITY = "BACKOFFICE_AUTHZ";
    static final String DIRTY = "BACKOFFICE_AUTHZ_DIRTY";

    private AuthzSession() {}

    /** 인가 인터셉터가 검사한 결과. 이전 형식은 읽되 첫 보호 요청에서 재계산한다. */
    public static EffectiveAuthority read(HttpSession session) {
        Object value = session.getAttribute(AUTHORITY);
        if (value instanceof Snapshot snapshot) return snapshot.authority();
        return value instanceof EffectiveAuthority authority ? authority : null;
    }

    /** 로그인 응답용 결과를 담는다. 색인 등록 전 회수를 놓치지 않도록 첫 요청은 재계산한다. */
    public static void initialize(HttpSession session, EffectiveAuthority authority) {
        session.setAttribute(DIRTY, newRevision());
        write(session, authority, null);
    }

    /** 반드시 권한 계산 전에 읽는다. 결과를 저장할 때 다시 읽으면 중간 회수를 지울 수 있다. */
    public static Object revision(HttpSession session) {
        return session.getAttribute(DIRTY);
    }

    /** 권한과 관측 표식은 분리 저장하지 않는다. 동시 요청의 서로 다른 결과가 섞이면 안 된다. */
    public static void write(HttpSession session, EffectiveAuthority authority, Object observedRevision) {
        session.setAttribute(AUTHORITY, new Snapshot(authority, observedRevision));
    }

    public static boolean isDirty(HttpSession session) {
        Object value = session.getAttribute(AUTHORITY);
        return !(value instanceof Snapshot snapshot)
                || !Objects.equals(snapshot.observedRevision(), revision(session));
    }

    /** 변경마다 다른 표식을 남긴다. 기존 Boolean 표식도 한 번 관측한 뒤에는 캐시를 쓸 수 있다. */
    public static void markDirty(HttpSession session) {
        session.setAttribute(DIRTY, newRevision());
    }

    static String newRevision() {
        return UUID.randomUUID().toString();
    }

    private record Snapshot(EffectiveAuthority authority, Object observedRevision) implements Serializable {
        private static final long serialVersionUID = 1L;
    }
}
