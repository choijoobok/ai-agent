package com.ordinary.backoffice.domain.notification.notice;

import java.time.Instant;

/**
 * 공지 하나 — 팝업(60 §9)과 공지 탭의 상세(60 §8)가 <b>같은 것을 본다</b>.
 *
 * <p>둘을 갈라 놓으면 팝업에서 읽은 것과 탭에서 읽은 것이 다를 수 있고, C안(66 §2.4)은
 * 정확히 그 둘이 <b>같은 공지</b>임을 전제한다 — 팝업의 <i>"공지 N건 더 있음"</i> 이
 * 여는 곳이 이 탭이다.
 *
 * @param contentTypeCd 지금은 언제나 {@code TEXT} 다(66 §4.3). <b>내려보내는 이유는
 *     읽는 쪽이 분기할 자리를 미리 열어 두려는 것</b>이다 — 리치 에디터를 붙이는
 *     프로젝트가 {@code HTML} 을 저장하는데 표시 측이 분기하지 않으면 <b>태그가 글자로
 *     보인다</b>(47 §9 · 66 §4.3). 값이 하나뿐이라 화면은 <b>{@code TEXT} 가 아니면
 *     그대로 텍스트</b>로 그린다 — 모르는 형식을 해석하는 것이 더 나쁘다
 */
public record NoticeDetail(
        Long noticeId,
        String title,
        String content,
        String contentTypeCd,
        Instant noticeFromDtm,
        Instant noticeToDtm,
        String regId,
        String regNm,
        NoticeStatus noticeStat) {}
