package com.aiagent.domain.batch.history;

/**
 * 상세 모달이 받는 것 — screen/batch/schedule/requirements.md. <b>탭 둘을 한 번에</b> 가져온다.
 *
 * <p>{@code ErrorLogDetail} 과 같은 모양이며 이유도 같다(screen/log/access/requirements.md) — 왕복을 나누면
 * <b>두 번째가 실패했을 때 절반만 열린 모달</b>이 된다. 다만 이쪽은 <b>두 값이 같은
 * 테이블에 있어</b> 조인조차 없다.
 *
 * <p><b>처음에는 탭 하나였다.</b> <i>"{@code RSLT_MSG} 는 {@code VARCHAR(1000)} 이라 목록
 * 컬럼으로 이미 보인다"</i> 가 근거였는데, sys/batch.md 이 요약과 상세를 가르면서 한 행에
 * {@code nclob} 이 둘이 됐다.
 *
 * <h2>{@code null} 과 <i>없다</i> 가 같은 사실이다 — 여기서는</h2>
 *
 * <p>{@code ErrorLogDetail} 은 그 둘을 갈라야 했다(전문 없이 남은 정상 행이 있어서).
 * 여기는 <b>같은 행의 두 컬럼</b>이라 {@code null} 이면 곧 <i>남기지 않았다</i> 이며,
 * 그래서 {@code *Found} 짝이 없다. 대신 <b>탭 비활성 사유가 컬럼마다 다르다</b>:
 *
 * <table><caption></caption>
 *   <tr><td>{@code rsltDtlMsg} 가 {@code null}</td>
 *       <td><i>"이 배치는 대상 목록을 남기지 않습니다"</i> — 대개의 배치가 그렇다</td></tr>
 *   <tr><td>{@code errMsg} 가 {@code null}</td>
 *       <td><i>"실패하지 않았습니다"</i> — 성공한 실행이다</td></tr>
 * </table>
 *
 * <p><b>사유는 탭 이름의 툴팁</b>이다 — screen/log/access/requirements.md 이 <i>"탭 안에 두었더니 비활성 탭이
 * 열리지 않아 볼 방법이 없었다"</i> 를 실측으로 적은 자리다.
 *
 * <p><b>둘 다 {@code null} 이면 이 모달이 열리지 않는다</b> — 목록의 {@code [보기]} 자체가
 * 없다(screen/batch/schedule/requirements.md). 그래도 이 레코드가 그 상태를 표현할 수 있는 것은, <b>목록을 본 뒤 파기
 * 배치가 지나갈 수 있기</b> 때문이 아니라(그때는 행이 아예 없어 404 다) 화면 밖 경로가
 * 이 API 를 직접 부를 수 있기 때문이다.
 */
public record BatchHistoryDetail(Long histId, String rsltDtlMsg, String errMsg) {

    /** 결과 상세 탭이 열리는가 — 아니면 비활성 + 툴팁이다(screen/batch/schedule/requirements.md). */
    public boolean hasDetail() {
        return rsltDtlMsg != null && !rsltDtlMsg.isEmpty();
    }

    /** 오류 탭이 열리는가. */
    public boolean hasError() {
        return errMsg != null && !errMsg.isEmpty();
    }
}
