package com.aiagent.domain.message.admin;

import com.aiagent.domain.message.MessageScope;
import java.time.Instant;
import java.util.List;

/**
 * 마스터 그리드의 한 행 — screen/admin/system/message/requirements.md.
 *
 * <p><b>{@code values} 가 {@code list} 컬럼이다</b>(frontend/grid.md). 하단 그리드는 이것을 그리며
 * <b>서버를 부르지 않는다</b> — 그래서 하단에 조회 버튼이 없고, 편집이 마스터 행에 남으므로
 * 다른 행에 갔다 돌아와도 그대로다.
 *
 * <p><b>지원 언어 전부가 들어 있다.</b> 값이 없는 언어도 {@code msgVal: null} 인 항목으로
 * 채워 보낸다 — 화면이 <i>"행이 없는 언어"</i> 와 <i>"값이 빈 언어"</i> 를 가를 이유가 없고,
 * 가르게 두면 하단의 행 수가 키마다 달라진다.
 *
 * @param bundled 사용처의 <b>파생</b>이다(sys/code.md) — 컬럼으로 저장하지 않는다. 계산을 여기서
 *     하는 것은 경계의 정의가 {@link MessageScope#bundled()} 하나이기 때문이며, 화면이 다시
 *     계산하면 같은 규칙이 두 곳에 생긴다
 */
public record MessageKeyRow(
        String msgKey,
        MessageScope useScope,
        boolean bundled,
        String msgDesc,
        String regId,
        Instant regDtm,
        String modId,
        Instant modDtm,
        List<MessageValue> values) {}
