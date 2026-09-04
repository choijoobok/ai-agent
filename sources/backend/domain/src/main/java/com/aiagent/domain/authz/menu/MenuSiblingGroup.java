package com.aiagent.domain.authz.menu;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 한 부모의 자식 목록 — sys/menu.md 가 정한 트리 편집 요청의 단위다.
 *
 * <p><b>이동 명령이 아니라 최종 상태다.</b> {@code {menuCd, newIndex}} 를 보내 서버가
 * 재계산하는 방식보다 결정적이며, UX-14 리스트 CUD 규약(<i>화면이 최종 상태를 보내고 서버가
 * 그대로 반영</i>)과 같은 형태다 — <b>배열 인덱스가 곧 {@code SORT_NO}</b> 다.
 *
 * @param upMenuCd 부모. <b>{@code null} 이 최상위</b>이며 그래서 {@code @NotBlank} 가 아니다 —
 *     최상위 형제의 순서도 바뀌어야 하고, 그 요청에는 부모가 없다
 * @param menuCds 그 부모의 자식 <b>전부</b>. 일부만 보내면 서버가 <b>빠진 것을 유실로
 * 읽는다</b> — sys/menu.md 의 집합 검증이 그것을 거부한다.
 *     <p><b>빌 수 있다.</b> 마지막 자식이 다른 부모로 가면 뺀 쪽의 자식이 {@code 0} 이 되는데,
 *     그 그룹을 빼면 <b>남은 형제의 {@code SORT_NO} 를 다시 쓸 기회가 사라진다</b> — 중간에서
 * 하나가 빠진 형제는 {@code 1,2,4} 가 되고, sys/menu.md 가 전체 재작성으로 얻으려던
 *     <i>언제나 정규화 상태</i> 가 깨진다
 */
public record MenuSiblingGroup(
        @Size(max = 30) String upMenuCd,
        @NotNull List<@Size(max = 30) String> menuCds) {}
