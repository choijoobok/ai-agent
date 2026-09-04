package com.aiagent.api.auth.check;

import com.aiagent.domain.auth.LoginResultCode;
import java.util.Optional;

/**
 * 로그인 후처리 검사 — AUTH-14. <b>체크 1개 = 클래스 1개</b>(sys/user-role.md).
 *
 * <p>{@code UserDetails} 플래그가 4개뿐이라 대응이 없는 검사가 셋 있다 — 휴면 · 허용 IP ·
 * 유효 권한 공집합. 휴면을 {@code isEnabled()} 에 섞으면 <i>"비활성인가 휴면인가"</i> 를
 * 구분할 수 없게 되고 로그인 이력 코드도 뭉개진다.
 *
 * <p><b>순서가 있다</b> — 권한 계산은 조인을 쓰므로 휴면·IP 다음이다(sys/user-role.md).
 * {@code @Order} 로 고정하고, 값싼 검사가 앞에서 걸러 준 뒤에야 계산이 돌도록
 * {@link LoginCandidate} 가 그것을 지연시킨다.
 */
public interface LoginPostCheck {

    /** 통과하면 빈 값, 걸리면 이력에 남길 결과 코드. */
    Optional<LoginResultCode> check(LoginCandidate candidate);
}
