package com.ordinary.backoffice.domain.batch.schedule;

/**
 * 등록이 바뀌었다 — <b>스케줄러가 다시 읽어야 한다</b>.
 *
 * <p>저장 서비스가 스케줄러를 <b>직접 부르지 않는 이유</b>가 둘이다.
 *
 * <table><caption></caption>
 *   <tr><td><b>커밋 뒤여야 한다</b></td>
 *       <td>롤백된 저장으로 크론을 다시 걸면 <b>없던 등록이 걸린다</b>.
 *           {@code @TransactionalEventListener(AFTER_COMMIT)} 가 그 순서를 표현한다 —
 *           {@code RoleController} 가 세션 무효화를 커밋 뒤로 미룬 것과 같은 규약이다</td></tr>
 *   <tr><td><b>스케줄러가 없을 수 있다</b></td>
 *       <td>테스트나 배치를 끈 프로필에서는 리스너가 없고, 그때 저장은 <b>그대로
 *           성공해야 한다</b>. 직접 호출이면 그 자리가 {@code null} 검사가 된다</td></tr>
 * </table>
 *
 * <p><b>무엇이 바뀌었는지 싣지 않는다.</b> 스케줄러는 전건을 다시 읽는 편이 단순하고
 * (등록이 수십 건이다 — 46 §5.2) 부분 갱신은 <i>어느 것을 지우고 어느 것을 다시 거는가</i>
 * 를 저장 쪽이 알아야 한다는 뜻이 된다. 삭제·활성화·크론 변경이 전부 다른 갱신이 되며,
 * 하나를 빠뜨리면 <b>바뀐 크론이 다음 재기동까지 반영되지 않는다</b>.
 */
public record BatchScheduleChanged() {}
