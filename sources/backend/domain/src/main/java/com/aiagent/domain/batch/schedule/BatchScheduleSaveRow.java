package com.aiagent.domain.batch.schedule;

import com.aiagent.core.grid.RowState;
import com.aiagent.domain.batch.entity.SysScheduleBatch;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 마스터 저장의 한 행 — 65 §3.2 · grid-standard.md §3.1.
 *
 * <p><b>파생 셋이 없다</b>({@code 다음 실행} · {@code 최근 결과} · {@code 실행 중}).
 * 서버가 계산하는 값이라 받을 경로를 두면 <b>화면이 게이트의 근거를 스스로 정하는</b>
 * 셈이 된다 — 읽기 전용은 화면에서만 읽기 전용이고 요청 본문은 조작할 수 있다(원칙 P1).
 * {@code RoleSaveRow} 가 건수 셋을 뺀 것과 <b>같은 장치</b>다.
 *
 * <p>{@code batchId} 는 신규 행에서만 뜻이 있고 수정·삭제에서는 <b>대상을 가리키는
 * 값</b>이다 — PK 라 고칠 수 없다(41 §3). 다만 이 테이블은 <b>물리 삭제가 있으므로</b>
 * (65 §3.8) 지우고 다시 만드는 길이 실제로 열려 있다.
 *
 * <h2>{@code @NotBlank} 가 {@code batchDesc} 에도 붙는다</h2>
 *
 * <p>46 §5.1 이 <i>"끄면 무슨 일이 생기는가를 적는 자리"</i> 로 정했고 65 §3.3 이 필수로
 * 집행했다. <b>DB 의 {@code NOT NULL} 과 이중</b>인 것이 의도다 — 제약에 걸리면
 * {@code DataIntegrityViolationException} 이고 그것은 사용자에게 <i>어느 칸이 문제인지</i>
 * 를 말하지 못한다(grid-edit-validation.md §3.3 이 요구하는 것은 <b>셀 단위</b> 오류다).
 */
public record BatchScheduleSaveRow(
        @NotNull RowState rowState,
        @NotBlank @Size(max = SysScheduleBatch.BATCH_ID_MAX) String batchId,
        @Size(max = SysScheduleBatch.BATCH_NM_MAX) String batchNm,
        @Size(max = SysScheduleBatch.BATCH_DESC_MAX) String batchDesc,
        @Size(max = SysScheduleBatch.BEAN_ID_MAX) String beanId,
        @Size(max = SysScheduleBatch.CRON_MAX) String cron,
        @Size(max = SysScheduleBatch.PARAM_JSON_MAX) String paramJson,
        @Min(1) Integer lockExpirySec,
        @Min(0) Integer lockMinIntervalSec,
        Boolean useYn,
        @Min(0) Integer sortNo) {

    /**
     * <b>{@code null} 이면 켜진 것으로 본다</b> — {@code RoleSaveRow} 와 같은 규칙이다.
     *
     * <p>화면은 언제나 값을 싣지만, 화면 밖 경로에서 빠뜨린 것을 <i>끈 것</i> 으로 읽으면
     * <b>만들자마자 안 도는 배치</b>가 생기고 그것은 조용하다 — 65 §3.6 이 <i>"안 돈다"</i>
     * 를 이력에 흔적이 없는 상태로 정의했기 때문이다.
     */
    public boolean useYnOrTrue() {
        return !Boolean.FALSE.equals(useYn);
    }

    /** {@code null} 이면 맨 뒤가 아니라 <b>맨 앞</b>이다 — 정렬이 오름차순이다(65 §3.3). */
    public int sortNoOrZero() {
        return sortNo == null ? 0 : sortNo;
    }
}
