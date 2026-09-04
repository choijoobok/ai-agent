package com.aiagent.domain.batch.schedule;

import com.aiagent.domain.batch.BatchResultCode;
import java.time.Instant;

/**
 * 마스터 그리드의 한 행 — 65 §3.2. <b>편집 폼이 없다</b>(grid-standard.md §1.1).
 *
 * <p>이 표가 목록이자 편집 화면이다. {@code BATCH_DESC} 가 <b>목록에 보이는 것</b>이
 * 46 §5.1 의 화면 쪽 절반이며, 기본 숨김이 아니다 — 장애 대응 중에 소스를 열 시간은 없다.
 *
 * <p><b>파생이 둘이다</b>({@link #nextExecDtm} · {@link #lastRsltCd}). 둘 다 저장된 컬럼이
 * 아니고 목록 조회가 계산해 내려준다 — 65 §3.4 가 <i>"API 를 늘리지 않는다"</i> 고 적은
 * 그것이다.
 *
 * @param nextExecDtm <b>서버가 계산한다</b> — 크론 파서가 프론트에 없다(65 §3.4).
 *     <b>꺼 둔 배치는 {@code null}</b> 이다: 스케줄러가 등록조차 하지 않으므로(65 §3.6)
 *     시각을 그리면 <i>돌 것처럼</i> 보인다. 기동 시 전건 재검증에 걸린 배치도 여기가
 *     빈다 — 그때 {@link #lastRsltCd} 가 {@code SKIP_COOLDOWN} 이다(65 §3.4)
 * @param lastRsltCd 하단 pane 첫 행과 <b>같은 값</b>이다(65 §3.9). 목록에서 훑고 pane 에서
 *     확인한다 — 한쪽은 20행을 한눈에, 한쪽은 한 배치를 깊이 본다.
 *     <b>한 번도 안 돈 배치는 {@code null}</b> 이며 화면이 {@code —} 로 그린다
 * @param running 지금 도는가 — <b>삭제 게이트의 한쪽</b>이다(65 §3.8).
 *     {@link #lastRsltCd} 로 대신하지 않는 것은 <i>가장 최근 실행이 {@code RUNNING}</i>
 *     과 <i>{@code RUNNING} 인 실행이 있다</i> 가 다르기 때문이다 — 유령이 남은 채
 *     다음 주기가 성공하면 최근 결과는 {@code SUCCESS} 인데 {@code RUNNING} 행은 남아 있다
 */
public record BatchScheduleRow(
        Integer sortNo,
        String batchId,
        String batchNm,
        String batchDesc,
        String beanId,
        String cron,
        Instant nextExecDtm,
        String paramJson,
        Integer lockExpirySec,
        Integer lockMinIntervalSec,
        Boolean useYn,
        BatchResultCode lastRsltCd,
        boolean running,
        String regId,
        Instant regDtm,
        String modId,
        Instant modDtm) {}
