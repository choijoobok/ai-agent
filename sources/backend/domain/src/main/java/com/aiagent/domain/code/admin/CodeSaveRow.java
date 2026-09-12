package com.aiagent.domain.code.admin;

import com.aiagent.core.grid.RowState;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Map;

/**
 * 하단 저장의 한 행 — screen/admin/system/code/requirements.md. <b>저장 하나가 테이블 셋을 쓴다.</b>
 *
 * <pre>
 * SYS_CODE      ← dtlCd · dtlDesc · useYn · sortNo
 * SYS_MESSAGE ← codeNm (키는 SYS_CODE_KEY 가 아니라 code.{GRP_CD}.{DTL_CD} — screen/admin/system/code/requirements.md)
 * SYS_CODE_REF ← refs (서버가 그 그룹의 정의 목록을 루프한다 — screen/admin/system/code/requirements.md)
 * </pre>
 *
 * <p><b>{@code grpCd} 가 행에 없다.</b> 이 그리드는 통째로 한 그룹의 것이므로 봉투가 갖는다 —
 * 행마다 두면 <i>한 요청에 여러 그룹</i> 이 표현 가능해지고, 그러면 서버가 <b>화면에 없는
 * 조합</b>을 받게 된다.
 *
 * <p><b>{@code dtlNm} 도 {@code sysYn} 도 없다</b> — 앞엣것은 서버가 PK 로 조립하고(sys/code.md)
 * 뒤엣것은 코드가 아는 사실이다(sys/code.md). 둘 다 <b>받을 경로를 두지 않는 것</b>이 장치다.
 *
 * @param codeNm 지금 세션 언어의 코드명. <b>비면 그 언어의 메시지 행을 지운다</b>(screen/admin/system/code/requirements.md) —
 * 빈 문자열을 넣으면 sys/code.md 의 폴백이 죽고 <i>"이름이 없는 코드"</i> 가 조용히 생긴다
 * @param refs 참조값 맵. <b>항목이 없는 것과 값이 빈 것이 같은 뜻</b>이다 — 둘 다 그 행을
 * 지운다(sys/code.md). 정의에 없는 {@code REF_CD} 는 거부한다(screen/admin/system/code/requirements.md)
 */
public record CodeSaveRow(
        @NotNull RowState rowState,
        @NotBlank @Size(max = 30) String dtlCd,
        @Size(max = 2000) String codeNm,
        @Size(max = 500) String dtlDesc,
        Boolean useYn,
        Integer sortNo,
        Map<String, @Size(max = 200) String> refs) {

    /**
     * 공백만 남은 값을 {@code null} 로 접는다 — <b>Oracle 은 {@code ''} 가 곧 {@code NULL}</b>
     * 이라(backend/persistence.md) 그러지 않으면 같은 데이터가 벤더마다 다르게 걸린다.
     */
    public CodeSaveRow {
        codeNm = blankToNull(codeNm);
    }

    public Map<String, String> refsOrEmpty() {
        return refs == null ? Map.of() : refs;
    }

    public boolean useYnOrTrue() {
        return useYn == null || useYn;
    }

    public int sortNoOrZero() {
        return sortNo == null ? 0 : sortNo;
    }

    static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
