package com.aiagent.core.error;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * 목록을 행 단위로 처리한다 — <b>트랜잭션 경계를 부르는 쪽이 고른다</b>(backend/row-transaction.md).
 *
 * <p><b>저장이냐 실행이냐로 갈리지 않는다.</b> 갈리는 것은 <i>이 목록이 실패했을 때 무엇이
 * 남아야 하는가</i> 하나이며, 그 답이 트랜잭션을 어떻게 나누는지를 정한다. 그래서 두
 * 메서드의 이름이 액션이 아니라 <b>경계</b>를 말한다.
 *
 * <table><caption></caption>
 *   <tr><th></th><th>{@link #oneTxForAll}</th><th>{@link #oneTxPerRow}</th></tr>
 *   <tr><td>트랜잭션</td><td><b>전체에 하나</b></td><td><b>행마다 하나</b></td></tr>
 *   <tr><td>실패하면</td><td>전부 되돌아간다</td><td><b>그 행만</b> 되돌아간다</td></tr>
 *   <tr><td>끝맺음</td><td>{@link BusinessException} 을 던진다</td>
 *       <td>{@link RowReport} 를 <b>돌려준다</b></td></tr>
 *   <tr><td>응답</td><td>400</td><td><b>200</b> — 전건 실패도 같다</td></tr>
 *   <tr><td>부르는 메서드</td><td>{@code @Transactional} <b>이어야</b> 한다</td>
 *       <td>{@code @Transactional} <b>이면 안 된다</b></td></tr>
 * </table>
 *
 * <p><b>마지막 줄이 이 클래스가 지킬 수 없는 약속이다</b> — 여기서는 트랜잭션을 열지도
 * 닫지도 못하고, 경계는 {@code @Transactional} 이 어디 붙어 있느냐가 정한다. 이름이 거짓이
 * 되지 않게 <b>빌드가 그 자리를 검사한다</b>({@code RowTxConventionTest}).
 *
 * <h2>순번은 요청 배열의 것이다</h2>
 *
 * <p>화면은 이 순번으로 행을 되찾아 <b>그 셀을 붉게 칠한다</b>. 그래서 <b>받은 목록을 그대로
 * 순회해야 한다</b> — 행을 상태별로 갈라 담은 뒤 그 목록을 돌리면 여기의 {@code i} 가 요청의
 * 순번이 아니게 되고, 화면에서 <b>남의 행이 붉어진다</b>. 예외도 경고도 나지 않는다.
 *
 * <p><b>순번은 언제나 화면이 고른 단위의 것이다.</b> 헤더를 고르고 그 아래 디테일을 건별로
 * 도는 실행이라면, 디테일의 실패는 <b>그 헤더 행의 사유로 접어 올린다</b> — 화면이 붉힐 수
 * 있는 것은 자기가 보낸 배열의 행뿐이고, 디테일 순번을 실어 보내면 <b>엉뚱한 헤더가
 * 붉어진다</b>.
 *
 * <h2>루프 안에서 던지지 않는다</h2>
 *
 * <p>하나씩 던지면 사용자가 저장을 N 번 눌러 오류를 하나씩 발견하고, <i>고칠 것이 몇
 * 개인지</i> 를 끝까지 모른다. 화면은 표로 한꺼번에 보여 줄 수 있어야 한다
 * (frontend/save-errors.md). 그래서 둘 다 <b>끝까지 돌고</b> 실패를 모은다.
 */
public final class RowTx {

    private RowTx() {}

    /**
     * <b>전체에 트랜잭션 하나</b> — 실패가 하나라도 있으면 전부 되돌아간다.
     *
     * <p>실패한 행이 있어도 끝까지 돈다. 앞선 행이 이미 영속화됐을 수 있지만 마지막에
     * 던지므로 <b>트랜잭션이 통째로 되돌아간다</b> — 부분 저장은 일어나지 않는다.
     *
     * <p><b>맨 앞 실패의 코드와 문구가 응답의 것이 된다.</b> 행마다 다른 코드일 수 있는데
     * 봉투의 {@code code} 는 하나뿐이라, 무엇 하나를 골라야 한다면 <b>사용자가 처음 만나는
     * 것</b>이 맞다. 낱낱의 사유는 {@code rows} 가 나른다.
     *
     * @param rows <b>요청이 보낸 그대로의 목록</b>. 걸러 내거나 정렬한 것을 넘기지 않는다
     * @param body 행 하나의 처리. {@link BusinessException} 을 던지면 그 행의 실패로 모인다
     * @throws BusinessException 실패한 행이 하나라도 있으면
     */
    public static <R> void oneTxForAll(List<R> rows, Consumer<R> body) {
        Collected collected = run(rows, body);
        if (!collected.failures.isEmpty()) {
            throw BusinessException.rows(collected.code, collected.message, collected.failures);
        }
    }

    /**
     * <b>행마다 트랜잭션 하나</b> — 성공한 행은 남고 실패한 행만 되돌아간다.
     *
     * <h2>부르는 메서드에 {@code @Transactional} 을 걸지 않는다</h2>
     *
     * <p>걸면 {@code body} 가 <b>바깥 트랜잭션 안에서</b> 돌아 행마다 커밋되지 않고, 게다가
     * 실패를 잡고 계속 돌기 때문에 커밋 시점에 {@code UnexpectedRollbackException} 이 난다 —
     * <b>499행이 성공한 실행이 통째로 사라진다</b>.
     *
     * <p>그래서 {@code body} 는 <b>다른 빈의 {@code @Transactional} 메서드</b>여야 한다:
     * 바깥에 트랜잭션이 없으므로 기본 전파({@code REQUIRED})가 행마다 새 트랜잭션을 연다.
     * <b>{@code REQUIRES_NEW} 가 필요 없다</b> — 그것은 바깥이 <i>반드시</i> 트랜잭션이어야
     * 할 때의 것이고(실행 이력 헤더처럼), 그때는 행마다 <b>커넥션을 둘</b> 잡는다: 바깥
     * 트랜잭션이 멈춰 있어도 자기 커넥션은 쥐고 있기 때문이다. 500행이면 풀이 마른다.
     *
     * <p><b>같은 빈의 메서드를 부르면 아무 일도 일어나지 않는다</b> — 프록시를 지나지 않아
     * 애너테이션이 무시되고, <b>예외도 경고도 없이</b> 전건이 한 덩이로 묶인다.
     *
     * <h2>업무 규칙 위반만 행의 실패다</h2>
     *
     * <p>{@link BusinessException} 이 아닌 것은 <b>잡지 않고 그대로 올린다</b>. 그것은 그 행이
     * 틀린 것이 아니라 <b>시스템이 고장 난 것</b>이고, 고장 난 채로 남은 499행을 계속 미는
     * 것은 손해를 키운다. 이미 커밋된 앞 행은 남으며 {@code traceId} 로 어디까지 갔는지
     * 찾는다.
     *
     * @param rows <b>요청이 보낸 그대로의 목록</b>. 걸러 내거나 정렬한 것을 넘기지 않는다
     * @param body 행 하나의 처리 — <b>다른 빈의 {@code @Transactional} 메서드</b>
     * @return 몇 건을 했고 무엇이 왜 안 됐나. <b>던지지 않는다</b>
     */
    public static <R> RowReport oneTxPerRow(List<R> rows, Consumer<R> body) {
        return RowReport.of(rows.size(), run(rows, body).failures);
    }

    private record Collected(List<BusinessException.RowError> failures, ErrorCode code, String message) {}

    private static <R> Collected run(List<R> rows, Consumer<R> body) {
        List<BusinessException.RowError> failures = new ArrayList<>();
        ErrorCode code = null;
        String message = null;

        for (int i = 0; i < rows.size(); i += 1) {
            try {
                body.accept(rows.get(i));
            } catch (BusinessException e) {
                if (code == null) {
                    code = e.errorCode();
                    message = e.getMessage();
                }
                failures.add(new BusinessException.RowError(i, e.fieldErrors()));
            }
        }
        return new Collected(failures, code, message);
    }
}
