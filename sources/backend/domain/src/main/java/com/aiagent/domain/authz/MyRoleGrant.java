package com.aiagent.domain.authz;

import java.time.LocalDate;

/**
 * 나에게 부여된 역할 하나 — sys/menu.md.
 *
 * <p><b>{@code effective} 가 이 레코드의 요점이다.</b> 부여가 있는데 권한이 없는 경우가
 * 둘인데(역할이 꺼졌다 · 기간 밖이다) 화면이 그 판정을 다시 하면 <b>같은 규칙이 두 곳</b>에
 * 생긴다 — 서버가 계산한 사실을 그대로 내린다.
 *
 * @param roleUseYn 역할 자체가 켜져 있는가. {@code effective} 가 거짓일 때 <b>둘 중 어느
 *     쪽인지</b> 를 화면이 말할 수 있어야 해서 함께 내린다 — 기간이 문제면 사용자가 기다리면
 *     되고, 역할이 꺼진 것이면 관리자에게 가야 한다.
 * @param validToDt {@code null} 이면 무기한이다. {@code 9999-12-31} 을 채우지 않는다(sys/menu.md).
 */
public record MyRoleGrant(
        String roleId,
        String roleNm,
        String roleDesc,
        LocalDate validFromDt,
        LocalDate validToDt,
        boolean roleUseYn,
        boolean effective) {}
