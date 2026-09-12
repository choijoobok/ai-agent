package com.aiagent.domain.code.admin;

import java.time.Instant;
import java.util.Map;

/**
 * 하단 그리드의 한 행 — screen/admin/system/code/requirements.md.
 *
 * <p><b>{@code DTL_NM} 이 없다.</b> 그 컬럼은 이름이 아니라 메시지 키이고(sys/code.md) 화면에 낼
 * 것이 아니다 — 내보내면 화면이 그것을 <i>보여줄 수 있는 값</i> 으로 여기게 된다.
 *
 * @param codeNm <b>지금 세션 언어의 코드명</b>이다(screen/admin/system/code/requirements.md). 값이 없으면 기본 언어, 그것도
 *     없으면 <b>키 문자열 그대로</b>이며 그것이 진단이다 — 셀에 {@code code.ORDER_KIND.B2B} 가
 * 보이면 아직 안 채운 것이다(sys/code.md). 빈 칸이나 코드값으로 떨어뜨리면 누락이 숨는다
 * @param refs 참조값 맵({@code REF_CD → REF_VAL}) — <b>전송 형태이지 저장 형태가 아니다</b>
 * (frontend/grid.md). 정의는 있는데 값이 없는 속성은 <b>키가 아예 없다</b>: 화면이 정의 목록과
 * 아우터 조인해 빈 셀을 그리며, 그 빈 칸이 곧 할 일이다(screen/admin/system/code/requirements.md)
 */
public record CodeRow(
        String dtlCd,
        String codeNm,
        String dtlDesc,
        Boolean useYn,
        Integer sortNo,
        Boolean sysYn,
        Map<String, String> refs,
        String regId,
        Instant regDtm,
        String modId,
        Instant modDtm) {}
