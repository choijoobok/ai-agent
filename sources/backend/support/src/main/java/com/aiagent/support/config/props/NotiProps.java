package com.aiagent.support.config.props;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 알림 모달의 목록 길이 — main-shell.md §7 · 60 §8.
 *
 * <p><b>탭 셋이 한 값을 쓴다.</b> 공지 · 내 알림 · 내 요청은 <b>같은 모달의 같은 자리</b>에
 * 그려지므로 길이가 갈릴 이유가 없다 — 셋으로 나누면 키가 셋이 되고, 그 셋을 다르게 두는
 * 근거를 아무도 대지 못한다.
 *
 * <p><b>페이징이 아니라 상한이다.</b> 그리드가 아니므로 다음 장이 없고, 넘친 것은
 * <b>화면이 말한다</b> — {@code noti.more} 가 <i>"최근 N건만 보입니다"</i> 를 낸다.
 * 조용히 자르면 <i>목록이 전부</i> 로 읽히고, 그러면 없는 알림을 없다고 확신한다.
 *
 * <p>{@code sys-config.} 아래인 것은 {@code MenuStatProps} 와 같은 이유다 — <b>운영 중에
 * 조정할 값</b>이고(목록이 짧다·모달이 무겁다) 바꾼다고 기동 구조가 달라지지 않는다.
 *
 * @param listSize 탭 하나가 내는 최대 행 수. 90일 보존(32 §3) 동안 쌓인 전부를 내려보내지
 *     않기 위한 것이며, <b>미읽음 배지는 이 값과 무관하게 전건을 센다</b> — 상한이 배지를
 *     깎으면 <i>배지는 3인데 목록엔 2</i> 가 생긴다(main-shell.md §7.1)
 */
@ConfigurationProperties(prefix = "sys-config.ui.noti")
@Validated
public record NotiProps(@NotNull @Min(1) @Max(500) Integer listSize) {}
