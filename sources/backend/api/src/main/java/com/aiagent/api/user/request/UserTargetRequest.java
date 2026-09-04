package com.aiagent.api.user.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 실행이 받는 <b>대상 행</b> — frontend/grid.md.
 *
 * <p>요청 페이로드가 <b>둘로 나뉜다</b>: 대상 행({@code targets})과 호출의 인자
 * ({@code params}). 섞으면 서버가 <i>"이 필드가 행의 것인가 파라미터인가"</i> 를 이름으로
 * 추측하게 된다.
 *
 * <p><b>{@code params} 필드가 여기 없다.</b> screen/user/requirements.md 의 실행 셋(잠금 해제 · 휴면 해제 ·
 * 비밀번호 초기화)은 <b>받을 인자가 없다</b> — 그리드도 그 자리를 비워 보낸다. 인자를 받는
 * 실행이 생기면 <b>그 요청 레코드가 자기 필드로</b> 가진다: 여기 미리 열어 두면 아무도 채우지
 * 않는 칸이 남고, 그 칸의 타입을 {@code Object} 로 두는 순간 검증이 사라진다.
 *
 * <p>대상은 <b>{@code USER_ID} 목록</b>이다. 행 전체를 보내지 않는 것은, 서버가 어차피
 * 다시 읽어야 하고({@code SysUserRepository}) 화면이 보낸 나머지 값을 <b>쓰지 않기</b>
 * 때문이다 — 받으면 <i>쓸 것처럼</i> 보인다.
 */
public record UserTargetRequest(
        @NotEmpty @Size(max = 1000) List<@NotBlank @Size(max = 30) String> targets) {}
