package com.aiagent.domain.auth;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 로그인 결과 <b>묶음</b> — {@link LoginResultCode} 열다섯을 셋으로 접는다.
 *
 * <p><b>왜 조회 스펙에서 나왔나.</b> 이 지식은 <i>"로그인 실패란 무엇인가"</i> 이지
 * <i>"이 화면이 어느 컬럼으로 물을 수 있나"</i> 가 아니다. 둘이 한 파일에 있으면
 * 조회 화면이 도메인 지식의 주인이 되고, 두 번째로 쓰는 곳(통계 · 알림)이 생기는 순간
 * <b>화면을 import 하게 된다.</b> 2026-09-05 재현 실험에서 독립한 재현 둘이 같은 자리를
 * 짚어 뽑았다.
 *
 * <h2>접두로 판정하지 않는다</h2>
 *
 * <p>{@code startsWith("FAIL_")} 로 두면 열거형에 이름을 더하는 순간 <b>묶음이 조용히
 * 바뀐다.</b> 집합을 적으면 새 코드는 어느 쪽인지 정하기 전까지 어느 묶음에도 안 걸리고,
 * 그것을 {@link #verifyExhaustive()} 가 잡는다.
 *
 * <h2>무엇이 이 약속을 지키나 — <b>테스트다</b></h2>
 *
 * <p>전에는 정적 초기화가 지켰고, 그것이 기동에 도는 것은 <b>우연이었다</b> —
 * {@code LoginLogQueryService} 의 정적 필드가 스펙을 건드려서였고, 아무것도 그 의존을
 * 선언하지 않았다. 투영 목록을 메서드 안으로 옮기는 흔한 리팩터 하나로 검사가 조용히
 * 첫 조회로 밀린다.
 *
 * <p>그래서 <b>{@code LoginResultGroupTest} 가 주 방어선이다</b> — 코드를 더하고 묶음을
 * 안 정하면 <b>빌드가 깨진다.</b> 기동에서 터지는 것은 운영에서 발견되지만 빌드는
 * 개발자 자리에서 끝난다. 아래 정적 블록은 이중 방어로 남긴다.
 */
public final class LoginResultGroup {

    /** <b>실패 열</b> — 들어오지 못한 사건. */
    public static final String FAILED = "FAILED";

    /** <b>종료 넷</b> — 들어왔다가 세션이 끝난 사건. 정상 동작이라 화면에서 회색이다. */
    public static final String CLOSED = "CLOSED";

    /**
     * <b>성공 하나.</b>
     *
     * <p>서버는 갖고 있으나 <b>화면은 후보로 내지 않는다</b>(screen/admin/system/log/login/requirements.md) —
     * 성공은 코드 하나라 접을 것이 없고, 결과 콤보가 한 번의 선택으로 이미 답한다.
     */
    public static final String SUCCESS = "SUCCESS";

    private static final Map<String, Set<LoginResultCode>> GROUPS = Map.of(
            SUCCESS,
            Set.of(LoginResultCode.SUCCESS),
            FAILED,
            Set.of(
                    LoginResultCode.FAIL_NO_USER,
                    LoginResultCode.FAIL_PWD,
                    LoginResultCode.FAIL_DISABLED,
                    LoginResultCode.FAIL_EXPIRED,
                    LoginResultCode.FAIL_LOCKED,
                    LoginResultCode.FAIL_DORMANT,
                    LoginResultCode.FAIL_IP,
                    LoginResultCode.FAIL_NO_AUTHORITY,
                    LoginResultCode.FAIL_TEMP_EXPIRED,
                    LoginResultCode.FAIL_CONCURRENT),
            CLOSED,
            Set.of(
                    LoginResultCode.LOGOUT,
                    LoginResultCode.SESSION_TIMEOUT,
                    LoginResultCode.FORCED_LOGOUT,
                    LoginResultCode.SESSION_EVICTED));

    static {
        verifyExhaustive();
    }

    private LoginResultGroup() {}

    /**
     * 묶음 이름 → 코드 집합. <b>모르는 이름이면 {@code null} 이다</b> — 거절의 문구와
     * 상태 코드는 부르는 쪽(조회 스펙)이 정한다.
     */
    public static Set<LoginResultCode> codesOf(String name) {
        return name == null ? null : GROUPS.get(name.toUpperCase(Locale.ROOT));
    }

    /**
     * <b>셋이 코드 전부를 덮는가.</b> 덮지 않으면 그 코드는 <i>실패만</i> 에도
     * <i>종료만</i> 에도 안 걸려, 그 조회를 하는 사람의 목록에서 <b>말없이 빠진다.</b>
     * 조용한 누락이 오류보다 나쁘다.
     */
    public static void verifyExhaustive() {
        List<LoginResultCode> uncovered = Arrays.stream(LoginResultCode.values())
                .filter(code -> GROUPS.values().stream().noneMatch(group -> group.contains(code)))
                .toList();
        if (!uncovered.isEmpty()) {
            throw new IllegalStateException(
                    "묶음이 정해지지 않은 로그인 결과 코드가 있다 — "
                            + uncovered
                            + " (screen/admin/system/log/login/requirements.md)");
        }
    }
}
