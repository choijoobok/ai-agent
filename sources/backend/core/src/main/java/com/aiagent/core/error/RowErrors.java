package com.aiagent.core.error;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * 그리드 저장의 행들을 돌리고 <b>실패를 모아 한 번 던진다</b> — backend/api.md §3-1.
 *
 * <p><b>루프 안에서 던지면 안 되는 이유</b>가 이것이다: 하나씩 던지면 사용자가 저장을 N 번
 * 눌러 오류를 하나씩 발견하고, <i>고칠 것이 몇 개인지</i> 를 끝까지 모른다. 화면은 표로
 * 한꺼번에 보여 줄 수 있어야 한다(frontend/save-errors.md).
 *
 * <h2>순번은 요청 배열의 것이다</h2>
 *
 * <p>화면은 이 순번으로 행을 되찾아 <b>그 셀을 붉게 칠한다</b>. 그래서 <b>받은 목록을 그대로
 * 순회해야 한다</b> — 행을 상태별로 갈라 담은 뒤 그 목록을 돌리면 여기의 {@code i} 가 요청의
 * 순번이 아니게 되고, 화면에서 <b>남의 행이 붉어진다</b>. 예외도 경고도 나지 않는다.
 *
 * <h2>모으고 나서 롤백한다</h2>
 *
 * <p>실패한 행이 있어도 끝까지 돈다. 앞선 행이 이미 영속화됐을 수 있지만 마지막에 던지므로
 * <b>트랜잭션이 통째로 되돌아간다</b> — 부분 저장은 일어나지 않는다.
 *
 * <p><b>맨 앞 실패의 코드와 문구가 응답의 것이 된다.</b> 행마다 다른 코드일 수 있는데 봉투의
 * {@code code} 는 하나뿐이라, 무엇 하나를 골라야 한다면 <b>사용자가 처음 만나는 것</b>이
 * 맞다. 낱낱의 사유는 {@code rows} 가 나른다.
 */
public final class RowErrors {

    private RowErrors() {}

    /**
     * @param rows <b>요청이 보낸 그대로의 목록</b>. 걸러 내거나 정렬한 것을 넘기지 않는다
     * @param body 행 하나의 처리. {@link BusinessException} 을 던지면 그 행의 실패로 모인다
     */
    public static <R> void each(List<R> rows, Consumer<R> body) {
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

        if (!failures.isEmpty()) {
            throw BusinessException.rows(code, message, failures);
        }
    }
}
