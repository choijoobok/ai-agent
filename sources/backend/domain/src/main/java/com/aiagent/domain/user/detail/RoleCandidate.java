package com.aiagent.domain.user.detail;

/**
 * 역할 후보 하나 — 보유 역할 탭의 콤보와 마스터 조회조건의 <i>역할</i> 이 <b>같은 목록</b>을
 * 본다(screen/user/requirements.md 탭 1).
 *
 * <h2>{@code ROLE_MGMT} 의 경로를 쓰지 않는다</h2>
 *
 * <p>screen/role/requirements.md 이 <i>"같은 그리드이면 경로도 같아야 한다"</i> 고 했지만 <b>이것은 그리드가
 * 아니다</b> — 콤보의 후보이며, screen/role/requirements.md 의 목록이 답하는 <i>"이 역할을 가진 사람"</i> 과
 * 아무 관계가 없다.
 *
 * <p>무엇보다 <b>권한이 갈린다.</b> 역할 화면의 경로를 부르면 그 요청이
 * {@code ROLE_MGMT} 의 {@code READ} 를 요구하게 되고(backend/api.md — 매핑이 경로를 따라간다),
 * 그러면 <b>사용자 관리만 가진 사람이 역할을 부여할 수 없다</b>. 화면이 자기 경로를
 * 가져야 하는 이유가 그것이며, {@code CODE_MGMT} 가 참조 코드 후보를 자기 {@code getList}
 * 로 읽은 것과 같은 판단이다(screen/code/requirements.md) — 거기는 마침 쓸 수 있는 자기 경로가 있었다.
 *
 * @param useYn <b>꺼진 역할도 후보다.</b> 부여는 되고 판정에서 걸릴 뿐이며(sys/menu.md 의 AND)
 *     <i>켜기 전에 부여를 구성해 두는</i> 동선이 정상이다 — 화면이 <b>표시로 그 사실을
 *     말한다</b>
 */
public record RoleCandidate(String roleId, String roleNm, Boolean useYn) {}
