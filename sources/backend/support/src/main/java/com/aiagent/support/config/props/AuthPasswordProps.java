package com.aiagent.support.config.props;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 비밀번호 정책 — sys/code.md. 값 검증은 DB 가 아니라 이 바인딩에서 한다(sys/code.md).
 *
 * <p>설명은 {@code @param} 에 쓴다 — 관리 화면의 설명 컬럼이 그것을 읽는다(screen/admin/system/code/requirements.md).
 *
 * @param minLength 비밀번호 최소 길이(AUTH-05).
 * @param requireCharsetKinds 영대·영소·숫자·특수 4계열 중 몇 종 이상을 요구하는가.
 * @param reuseBlockCount 재사용 금지 건수 — {@code SYS_USER_PWD_HIST} 비교 건수이자 보관
 * 건수다(sys/user-role.md).
 * @param expireDays 변경 주기(일). 경과하면 접근 제어 체인 #5 가 강제 변경으로 보낸다.
 * @param expireNoticeDays 만료 며칠 전부터 알릴 것인가.
 * @param tempValidHours 관리자 발급 임시 비밀번호의 유효 시간. 넘으면 로그인 자체를 막고
 * 재발급을 요구한다 — {@code PWD_INIT_YN='Y'} 가 90일 방치되는 것을 막는다(backend/security.md).
 * @param adminResetEnabled 관리자 임시 비밀번호 발급 허용 여부. <b>기본이 {@code true} 인
 *     것이 결정이다</b> — 메일 연동이 없는 배포에서 잠긴 계정을 푸는 <b>유일한 경로</b>다.
 * 끄면 복구 수단이 사라진다(backend/security.md).
 * @param reset 자기 재설정(AUTH-07)의 값 묶음.
 */
@ConfigurationProperties(prefix = "sys-config.auth.password")
@Validated
public record AuthPasswordProps(
        @NotNull @Min(4) Integer minLength,
        @NotNull @Min(1) @Max(4) Integer requireCharsetKinds,
        @NotNull @Min(0) Integer reuseBlockCount,
        @NotNull @Min(0) Integer expireDays,
        @NotNull @Min(0) Integer expireNoticeDays,
        @NotNull @Min(1) Integer tempValidHours,
        @NotNull Boolean adminResetEnabled,
        @NotNull @Valid Reset reset) {

    /**
     * 자기 재설정(AUTH-07). 6자리는 100만 조합이라 시도 한도와 만료가 없으면 무작위 대입이
     * 성립한다.
     *
     * @param tokenValidMinutes 재설정 코드의 유효 시간(분).
     * @param tryLimit 코드 입력 시도 허용 횟수.
     * @param requestCooldownSeconds 재발급 요청 사이의 최소 간격(초).
     */
    public record Reset(
            @NotNull @Min(1) Integer tokenValidMinutes,
            @NotNull @Min(1) Integer tryLimit,
            @NotNull @Min(0) Integer requestCooldownSeconds) {}
}
