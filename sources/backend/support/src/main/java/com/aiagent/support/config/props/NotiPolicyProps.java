package com.aiagent.support.config.props;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 알림을 <b>누구에게 언제</b> 보내는가 — 66 §6.2 의 생산자 셋이 읽는다.
 *
 * <p><b>{@code NotiProps}(= {@code sys-config.ui.noti}) 와 다른 층이다.</b> 저쪽은
 * <i>화면이 몇 줄을 그리는가</i> 이고 여기는 <b>정책</b>이다 — 하나는 UI 값이라
 * {@code ui.} 아래이고, 이것은 운영 규칙이라 {@code noti.} 아래다(43 §6.4 의 구분).
 *
 * <h2>채널 키가 없다</h2>
 *
 * <p>65 §3.11 이 BATCH-06 을 <i>"전역 설정 하나 — 수신 대상과 채널"</i> 로 남겼는데,
 * <b>채널이 인앱뿐이면 채널 설정이 없다</b>(66 §6.1 · §6.2). 남는 것은 수신 대상 하나이며
 * 그것이 {@link #batchFailRole} 이다. 외부 채널이 붙는 날 그 키 옆에 채널 키가 붙는다.
 *
 * @param batchFailRole 배치 실패 알림을 받을 <b>역할</b>(BATCH-06). 그 역할을 <b>지금
 *     유효하게</b> 가진 사람 전부에게 간다. <b>비우면 보내지 않는다</b> — 65 §3.11 이
 *     <i>배치별 on/off 를 두지 않는다</i> 고 한 것은 <b>배치마다 잊는 것</b>을 막으려는
 *     것이고, 시스템 전체를 끄는 결정은 한 곳에서 한 번 하는 것이라 성격이 다르다.
 *     <b>없는 역할을 적으면 조용히 0명</b>이다(오타가 그렇게 보인다 — 그래서 보내는 쪽이
 *     대상 0명을 로그에 남긴다)
 * @param authzExpireNoticeDays 권한 만료를 <b>며칠 전에</b> 알릴지(AUTHZ-08).
 *     비밀번호 쪽({@code auth.password.expire-notice-days})과 <b>따로 두는 이유</b>는
 *     사람이 할 일이 다르기 때문이다 — 비밀번호는 <b>혼자 바꾸면 끝</b>이지만 권한은
 *     <b>남에게 신청하고 기다려야</b> 한다(60 §8.3). 승인이 걸리는 조직일수록 이 값이 커진다
 */
@ConfigurationProperties(prefix = "sys-config.noti")
@Validated
public record NotiPolicyProps(
        @NotNull String batchFailRole,
        @NotNull @Min(1) @Max(365) Integer authzExpireNoticeDays) {}
