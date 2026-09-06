package com.aiagent.core.error;

import java.util.List;

/**
 * 건별 처리의 결과 — <b>던지지 않고 돌려준다</b>(backend/row-transaction.md).
 *
 * <pre>
 * { "success": true, "data": { "total": 500, "done": 488, "failed": 12,
 *                              "rows": [ { "index": 3, "fields": [ … ] }, … ] } }
 * </pre>
 *
 * <h2>전건이 실패해도 200 이다</h2>
 *
 * <p>실패로 답하고 싶어지지만, <b>사용자가 할 일이 같다</b> — 표를 보고 고쳐 다시 낸다.
 * 상태 코드를 가르면 화면에 분기가 하나 늘고 <b>그 분기가 하는 일이 없다</b>: 같은 표를 두
 * 경로에서 그리게 된다.
 *
 * <p>그리고 <b>이것은 거부된 요청이 아니다</b>. 요청은 받아들여졌고 500건을 시도했으며 그중
 * 0건이 됐다 — 400 은 <i>요청이 틀려서 아무것도 시도하지 못했다</i> 는 뜻이라 사실과 다르다.
 *
 * @param total 시도한 행 수 — 요청 배열의 크기다
 * @param done 커밋된 행 수
 * @param failed 되돌아간 행 수. {@code rows.size()} 와 같지만 <b>화면이 세지 않게</b> 담는다
 * @param rows 실패한 행들 — 순번은 <b>요청 배열</b>의 것이다({@link RowTx})
 */
public record RowReport(int total, int done, int failed, List<BusinessException.RowError> rows) {

    public RowReport {
        rows = List.copyOf(rows);
    }

    /** 실패 목록에서 나머지 셋을 센다 — <b>세는 자리가 하나여야</b> 합이 어긋날 길이 없다. */
    public static RowReport of(int total, List<BusinessException.RowError> failures) {
        return new RowReport(total, total - failures.size(), failures.size(), failures);
    }

    /** 전건이 됐나 — 화면이 <b>성공 모달</b>과 <b>결과 표</b> 중 무엇을 띄울지 가르는 값이다. */
    public boolean allDone() {
        return rows.isEmpty();
    }
}
