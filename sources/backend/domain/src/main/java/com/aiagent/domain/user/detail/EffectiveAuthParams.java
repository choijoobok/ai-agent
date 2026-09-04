package com.aiagent.domain.user.detail;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 유효 권한 탭의 부모 키 <b>+ 표시 범위</b> — screen/user/requirements.md.
 *
 * <p>{@link UserIdParams} 를 쓰지 않는 유일한 탭이다. 이 탭에만 <b>범위 토글</b>이 있기
 * 때문이며(그리드 헤더 ⓐ의 {@code select} — frontend/grid.md), 그것은 screen/user/requirements.md 의 요구 2 다:
 * <b>없는 것도 보여야 한다</b> — <i>"왜 못 보나"</i> 는 <b>권한이 없는 행</b>에 답이 있다.
 *
 * <p><b>조건이 아니라 {@code params} 인 이유</b>가 다른 것들과 조금 다르다. 이것은 부모 키가
 * 아니라 <i>사용자가 고른 것</i> 이지만, 값에 따라 <b>응답의 건수 단위가 바뀐다</b> —
 * 부여 행을 세느냐 메뉴를 세느냐. 조건 목록의 한 칸으로 두면 화이트리스트가 그것을
 * <i>거르는 조건</i> 으로 말하게 되는데, 여기서 하는 일은 거르기가 아니라 <b>무엇을 행으로
 * 낼지를 정하는 것</b>이다.
 */
public record EffectiveAuthParams(@NotBlank @Size(max = 30) String userId, Boolean heldOnly) {

    /**
     * 기본이 <b>가진 것만</b>이다.
     *
     * <p>이 탭에 오는 흔한 이유가 <i>"이 사람이 무엇을 할 수 있나"</i> 이고, 전체 메뉴는
     * 화면 수만큼 행이 나온다 — 진단이 필요할 때 켜는 것이 맞다.
     */
    public boolean heldOnlyOrTrue() {
        return heldOnly == null || heldOnly;
    }
}
