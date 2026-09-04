package com.aiagent.domain.progress;

import java.time.Instant;

/**
 * 폴링이 보는 진행률 — 엔티티가 아니라 <b>사진</b>이다.
 *
 * <p>엔티티를 그대로 내보내면 {@code USER_ID} 가 응답에 실린다. 그 값은 <b>인가의
 * 근거</b>이지 화면이 그릴 것이 아니며(sys/batch.md), 남의 것을 감추려고 담은 컬럼을
 * 응답으로 되돌려 주는 꼴이 된다.
 *
 * @param totCnt <b>{@code null} 일 수 있다</b> — 전체를 모르는 작업이 있다(sys/batch.md).
 *     화면은 그때 불확정 막대를 그린다
 * @param subTitle 지금 <b>어느 구간</b>인가 — 구간이 갈리지 않는 작업은 {@code null} 이고
 *     화면은 그 줄을 그리지 않는다
 */
public record JobProgressView(
        String jobId,
        JobStatus jobStatCd,
        long curCnt,
        Long totCnt,
        String subTitle,
        String stepMsg,
        String errMsg,
        Instant modDtm) {}
