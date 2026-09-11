package com.aiagent.api.auth.response;

import java.util.List;
import java.util.Map;

/**
 * 비밀번호 규칙 목록 — {@code documents/screen/_standalone/system/pwd-change/requirements.md} §6-2 의 계약.
 *
 * <p><b>규칙 목록의 출처가 서버 하나다.</b> 프론트는 <i>식별자 → 검증 함수</i> 매핑만 갖고
 * 파라미터도 문구도 갖지 않는다 — 그래야 즉시 검증 문구와 제출 뒤 거절 문구가 같은
 * {@code SYS_MESSAGE} 행에서 나와 <b>갈릴 수 없다</b>.
 *
 * <p><b>어긋남은 한쪽으로만 난다.</b> 프론트가 모르는 식별자는 건너뛰고 서버가 잡는다 —
 * 서버가 규칙을 더해도 <i>조용히 통과시켰다가 거절</i> 이지 그 반대는 성립하지 않는다.
 *
 * <h2>재설정 값 둘이 함께 실린다</h2>
 *
 * <p>화면이 <i>"인증번호는 10분간 유효합니다"</i> 를 그리고 <b>재발송 타이머를 직접 센다</b>
 * (요건서 §6-3 — 서버가 남은 초를 말하면 존재하는 계정에만 쿨다운이 걸린다는 사실이 열거
 * 단서가 된다). 그러려면 두 숫자를 알아야 하는데, <b>화면 코드에 박지 않는 것이 규약</b>이라
 * 어딘가로는 내려와야 한다.
 *
 * <p>여기 싣는 이유는 <b>같은 설정 묶음</b>이기 때문이다({@code sys-config.auth.password.*}).
 * 별도 API 를 두면 재설정 화면 하나가 왕복 둘로 열린다.
 *
 * @param rules 순서가 곧 화면의 체크리스트 순서다
 * @param reset 재설정 화면이 그릴 두 숫자. 그 화면 밖에서는 쓰이지 않는다
 */
public record PasswordPolicyResponse(List<Rule> rules, Reset reset) {

    /**
     * @param tokenValidMinutes 인증번호 유효 시간(분) — 화면의 안내 문구가 쓴다
     * @param resendCooldownSeconds 재발송 최소 간격(초) — 화면의 타이머가 쓴다
     */
    public record Reset(int tokenValidMinutes, int resendCooldownSeconds) {}

    /**
     * @param id 식별자. 프론트의 매핑 키이며 <b>문구가 아니다</b>
     * @param params 규칙의 파라미터 — {@code SYS_CONFIG} 에서 온다. 없으면 빈 맵이다
     * @param clientCheckable 프론트가 판정할 수 있는가. {@code false} 면 <b>건너뛴다</b> —
     *     서버가 잡으며 그것이 실패의 안전한 방향이다
     * @param message 서버가 <b>번역과 인자 치환까지 마친</b> 문구
     */
    public record Rule(
            String id, Map<String, Object> params, boolean clientCheckable, String message) {}
}
