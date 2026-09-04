package com.aiagent.domain.user;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 내 프로필 — USER-05 · main-shell.md §8 의 <b>내 정보</b> 탭.
 *
 * <p><b>조회와 수정이 한 화면이다</b>(main-shell.md §8). 그래서 이 하나로 읽기 전용 항목과 편집 항목을
 * 함께 나른다 — 편집되는 것은 {@code userNm} · {@code email} 둘뿐이고 나머지는 계정의
 * 사실이다.
 *
 * <p><b>{@code localeCd} 가 여기 있지만 이 화면이 바꾸지 않는다.</b> 언어는 설정 모달의
 * 것이며(main-shell.md §9.1) 여기서는 <i>지금 무엇으로 되어 있는가</i> 만 보인다 — 같은 값을 바꾸는
 * 자리가 둘이면 어느 쪽이 정본인지 사용자가 알 수 없다.
 *
 * <p><b>비밀번호 해시는 없다.</b> 대신 <i>언제 바꿨는가</i>({@code pwdChgDtm})와
 * <i>며칠 남았는가</i>({@code pwdExpiresInDays})를 준다 — 비밀번호 변경 탭이 <b>지금 바꿔야
 * 하는지</b> 를 말할 수 있어야 한다(security-design.md §4 체인 #5).
 *
 * @param pwdExpiresInDays {@code null} 이면 주기 만료를 쓰지 않는 설정이다. 음수면 이미
 *     지났다 — 0 과 갈라 두는 이유는 <i>오늘 만료</i> 와 <i>지난주에 만료</i> 가 다른 안내를
 *     받아야 하기 때문이다.
 * @param pwdInitYn 관리자가 발급한 임시 비밀번호를 아직 쓰고 있다. 체인 #5 의 독립 조건이다.
 */
public record MyProfile(
        String userId,
        String userNm,
        String email,
        String localeCd,
        LocalDate validFromDt,
        LocalDate validToDt,
        Instant lastLoginDtm,
        Instant pwdChgDtm,
        boolean pwdInitYn,
        Integer pwdExpiresInDays,
        PasswordRule passwordRule) {}
