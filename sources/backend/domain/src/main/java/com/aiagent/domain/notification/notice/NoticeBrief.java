package com.aiagent.domain.notification.notice;

import java.time.Instant;

/**
 * 알림 모달 <i>공지사항</i> 탭의 한 줄 — 60 §8 · 66 §4.4.
 *
 * <p><b>{@code content} 가 없다.</b> {@code NoticeRow}(관리 화면)와 갈리는 자리이며 근거가
 * 반대다 — 저쪽은 <b>본문이 편집 대상</b>이라 목록에 싣지만(66 §4.3), 여기서 본문은
 * <b>고른 하나만</b> 읽는다. {@code nclob} 을 50건 실어 놓고 그중 하나를 보는 것은
 * 모달을 여는 비용을 <b>안 볼 49건에 매기는 것</b>이다.
 *
 * @param regNm <b>작성자 이름</b> — {@code REG_ID} 를 그대로 보이면 사람이 아니라 계정이
 *     보인다. 이름을 못 찾으면 ID 가 그대로 온다(끊어질 수 있는 참조는 아니지만 감사
 *     컬럼에 FK 가 없다 — 40 §4.2)
 * @param noticeStat <b>서버 판정</b>이다(66 §4.4). 이 탭은 {@code ACTIVE} 와
 *     {@code EXPIRED} 만 보며, 배지가 아니라 <b>흐리게 그리는 근거</b>다(`NI-04`)
 */
public record NoticeBrief(
        Long noticeId,
        String title,
        Instant noticeFromDtm,
        Instant noticeToDtm,
        String regId,
        String regNm,
        NoticeStatus noticeStat) {}
