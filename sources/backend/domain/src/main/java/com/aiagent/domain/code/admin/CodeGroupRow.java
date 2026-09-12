package com.aiagent.domain.code.admin;

import java.time.Instant;

/**
 * 마스터 그리드의 한 행 — screen/admin/system/code/requirements.md.
 *
 * <p><b>{@code useYn} 이 없다</b>(2026-08-30 — sys/code.md). 그룹은 콤보의 후보가 아니라 소스가
 * 이름으로 지목하는 것이라 <b>끄는 것의 뜻이 정의되지 않는다</b>. 코드 쪽에는 그대로 있다.
 *
 * @param codeCount 그 그룹의 코드 수. <b>삭제 게이트가 읽는다</b>(frontend/grid.md · screen/admin/system/code/requirements.md) — 화면이
 *     하단을 조회하기 전에도 <i>지울 수 있는가</i> 에 답할 수 있어야 하고, 조회 응답이 이미
 * 갖고 있으므로 왕복이 늘지 않는다(frontend/grid.md 의 <i>건수 컬럼</i> 경로)
 * @param sysYn 읽기 전용이다 — 화면에 켜고 끄는 수단이 없다(screen/admin/system/code/requirements.md). 응답에 실리는 것은
 *     <b>배지를 그리기 위해서</b>이며, 왜 못 지우는지가 눌러 보기 전에 보여야 한다
 */
public record CodeGroupRow(
        String grpCd,
        String grpNm,
        String grpDesc,
        Integer sortNo,
        long codeCount,
        Boolean sysYn,
        String regId,
        Instant regDtm,
        String modId,
        Instant modDtm) {}
