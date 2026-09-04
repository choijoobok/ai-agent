package com.aiagent.domain.batch;

/**
 * 배치가 남기는 것 — sys/batch.md. <b>요약과 상세가 따로다.</b>
 *
 * <p>그 절이 <i>"{@code BatchJob} 결과 레코드가 요약과 상세를 <b>따로</b> 돌려주며,
 * 상세를 돌려주지 않으면 NULL 이다"</i> 라고 적은 그 레코드다.
 *
 * <table><caption></caption>
 *   <tr><th></th><th>무엇</th><th>어디로</th></tr>
 *   <tr><td>{@link #summary()}</td><td><i>"대상 1,204건 중 1,201건 처리 · 3건 제외"</i></td>
 * <td>{@code RSLT_MSG} — <b>목록 컬럼</b>이다(screen/batch/schedule/requirements.md)</td></tr>
 *   <tr><td>{@link #detail()}</td><td>처리한 대상의 목록 — 주문번호·창고코드가 수백 줄</td>
 * <td>{@code RSLT_DTL_MSG} — {@code nclob}, 모달의 탭(screen/batch/schedule/requirements.md)</td></tr>
 *   <tr><td>{@link #canceled()}</td><td><b>중단 요청을 읽고 스스로 멈췄는가</b></td>
 * <td>{@code RSLT_CD} — {@code CANCELED} 인가 {@code SUCCESS} 인가(sys/batch.md)</td></tr>
 * </table>
 *
 * <p><b>요약과 상세를 한 필드로 합치지 않는 이유가 컬럼이 둘인 이유와 같다.</b>
 * {@code VARCHAR(1000)} 에 대상 목록을 담으면 넘치고, 전부 {@code nclob} 으로 올리면
 * <i>"어느 배치가 몇 건을 처리했나"</i> 를 목록에서 훑을 수 없다 — frontend/grid.md 가
 * {@code nclob} 의 정렬을 <b>규칙으로</b> 끄기 때문이다(Oracle 이 {@code CLOB} 의
 * {@code ORDER BY} 를 막는다).
 *
 * <h2>{@link #canceled()} 는 sys/batch.md 표의 셋째와 넷째를 가르는 유일한 값이다</h2>
 *
 * <p>그 표가 <b>중단됨</b>({@code CANCELED})과 <b>요청했는데 그냥 끝났다</b>
 * ({@code SUCCESS}·{@code FAIL})를 다른 줄로 두었는데, 둘 다 {@code CANCEL_REQ_DTM} 이
 * 있고 둘 다 배치가 정상 반환한 경우다 — <b>러너는 구분할 수단이 없다.</b> 요청 시각만
 * 보고 {@code CANCELED} 로 적으면 <i>확인하지 않는 구현</i> 이 멈춘 것처럼 기록되고,
 * 그것이 screen/batch/schedule/requirements.md 가 <b>"화면은 그것을 거짓말하지 않는다"</b> 로 금지한 바로 그 상태다.
 *
 * <p>그래서 <b>멈춘 쪽이 말한다</b>. sys/batch.md 이 이 레코드의 필드를 둘로 적었을 때 그
 * 구분이 아직 없었고, 여기서 셋이 된다 — 문서로 되돌려 준다.
 *
 * <p><b>{@code summary} 는 잘린다.</b> 1000자 상한이고 초과분을 엔티티가 자른다 —
 * 요약이 1000자를 넘겼다면 그것은 요약이 아니라 상세가 잘못 들어온 것이다.
 *
 * <p><b>상세를 습관적으로 채우지 않는다.</b> 보존이 1년이라(retention.md) 모든 실행이 상세를
 * 채우면 비대화가 빨라진다 — sys/batch.md 이 {@code SKIP_LOCK} 의 적재량과 <b>같은 축의
 * 실측</b>으로 남겨 둔 미결이다.
 */
public record BatchJobResult(String summary, String detail, boolean canceled) {

    private static final BatchJobResult EMPTY = new BatchJobResult(null, null, false);

    /** 남길 것이 없다 — 둘 다 {@code NULL} 이고 화면의 {@code [보기]} 도 생기지 않는다. */
    public static BatchJobResult empty() {
        return EMPTY;
    }

    /** 요약만 — <b>가장 흔한 모양</b>이다. 상세는 남길 것이 있는 배치만 채운다. */
    public static BatchJobResult of(String summary) {
        return new BatchJobResult(summary, null, false);
    }

    /** 요약과 상세 둘 다 — 상세 탭이 열린다(screen/batch/schedule/requirements.md). */
    public static BatchJobResult of(String summary, String detail) {
        return new BatchJobResult(summary, detail, false);
    }

    /**
     * <b>중단 요청을 읽고 멈췄다</b> — {@code RSLT_CD} 가 {@code CANCELED} 가 된다.
     *
     * <p>이 자리에 요약을 남기는 것이 중요하다. <i>"1,204건 중 300건에서 중단됐다"</i> 는
     * 다시 돌릴 때 어디부터인지를 정하는 값이며, 중단은 <b>다시 돌릴 것을 전제로 하는
     * 조작</b>이다.
     */
    public static BatchJobResult canceled(String summary) {
        return new BatchJobResult(summary, null, true);
    }

    /** 중단됐고 남길 상세도 있다 — 어디까지 처리했는지의 목록이 그것이다. */
    public static BatchJobResult canceled(String summary, String detail) {
        return new BatchJobResult(summary, detail, true);
    }

    /** {@code null} 을 돌려준 구현을 여기서 흡수한다 — 러너가 매번 판정하지 않게. */
    public static BatchJobResult orEmpty(BatchJobResult result) {
        return result == null ? EMPTY : result;
    }
}
