package com.aiagent.domain.batch.history;

import com.aiagent.domain.batch.BatchExecType;
import com.aiagent.domain.batch.BatchResultCode;
import java.time.Instant;

/**
 * 실행 이력 한 행 — screen/admin/system/batch/history/requirements.md. <b>{@code nclob} 둘이 없다.</b>
 *
 * <p>{@code RSLT_DTL_MSG} 도 {@code ERR_MSG} 도 컬럼 표에 없다(screen/admin/system/batch/history/requirements.md) — 목록에 싣지
 * 않으며 그 자리에 {@link #hasDetail} 한 칸이 온다. {@code ErrorLogRow} 가
 * {@code rootCauseStack} 대신 {@code hasStack} 을 둔 것과 같은 모양이다.
 *
 * <p><b>{@code RSLT_MSG} 는 있다.</b> {@code VARCHAR(1000)} 이라 실을 수 있고, 실려야
 * <i>"어느 배치가 몇 건을 처리했나"</i> 를 목록에서 읽는다 — sys/batch.md 이 요약을
 * {@code nclob} 으로 올리지 않은 이유 전부다. <b>요약은 셀에서 훑고 상세는 모달에서 읽는다.</b>
 *
 * @param batchNm 조인해 온 이름 — <b>{@code null} 이면 지워진 등록</b>이다(sys/batch.md · screen/admin/system/batch/schedule/requirements.md).
 * 화면이 {@code (삭제된 배치)} 로 그리며 <b>이름을 지어내지 않는다</b> — screen/admin/system/log/access/requirements.md 가
 *     없는 계정에 이름을 붙이지 않기로 한 것과 같은 판단이다
 * @param elapsedMs <b>ms 원본</b>이다 — 화면이 {@code duration} 렌더러로 사람 단위로만
 * 바꾼다(screen/admin/system/batch/history/requirements.md). 서버가 포맷한 문자열을 주면 정렬이 문자열 정렬이 되어
 *     {@code 9분 > 10분} 이 된다
 * @param hasDetail 상세 모달의 <b>탭 둘 중 하나라도 열 것이 있는가</b>(screen/admin/system/batch/history/requirements.md).
 *     <b>{@code false} 면 {@code [보기]} 자체가 없다</b> — 열 것이 없는데 링크를 두면
 *     <i>눌러 보고서야 빈 것을 아는 셀</i>이 된다
 * @param cancelReqDtm 있는데 {@code rsltCd} 가 아직 {@code RUNNING} 이면 <b>중단 중</b>이다
 * (sys/batch.md). 한 컬럼으로는 표현할 수 없는 그 상태이며, 중단 버튼이 이 값으로 비활성된다
 */
public record BatchHistoryRow(
        Long histId,
        Instant startDtm,
        String batchId,
        String batchNm,
        BatchExecType execTypeCd,
        BatchResultCode rsltCd,
        Long elapsedMs,
        String rsltMsg,
        boolean hasDetail,
        Instant endDtm,
        String nodeId,
        Instant cancelReqDtm) {}
