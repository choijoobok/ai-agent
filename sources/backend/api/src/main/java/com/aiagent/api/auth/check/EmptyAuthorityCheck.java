package com.aiagent.api.auth.check;

import com.aiagent.domain.auth.LoginResultCode;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.AuthLoginProps;
import java.util.Optional;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * 유효 권한 공집합 — security-design.md §4. <b>빈 셸로 들여보내지 않는다.</b>
 *
 * <p><b>기준은 "역할 미부여" 가 아니라 "유효 권한 공집합" 이다.</b> 역할이 하나도 없어도 개인
 * 예외 권한(AUTHZ-07)만으로 일하는 사용자가 정당하게 존재한다 — 개인 예외는 합집합의 독립
 * 항이므로 역할 유무로 판정하면 그 사용자가 부당하게 막힌다.
 *
 * <table>
 *   <tr><th>왜 빈 메뉴로 들여보내지 않는가</th><th></th></tr>
 *   <tr><td>공격면이 0 이 아니다</td>
 *       <td>로그인 성공은 세션 발급이다. 권한 0 인 세션도 {@code /api/common/**} 에 접근한다</td></tr>
 *   <tr><td>원인을 알려주지 못한다</td>
 *       <td><i>"로그인은 되는데 아무것도 없다"</i> 는 사용자가 스스로 해결할 수 없고 전량 문의가 된다</td></tr>
 *   <tr><td>실패 방향이 맞다</td>
 *       <td>권한 부여를 잊은 것이 <b>로그인 단계에서</b> 드러난다 — deny by default 와 같은 방향</td></tr>
 * </table>
 *
 * <p><b>{@code @Order} 가 휴면(10)보다 뒤인 것이 규약이다</b>(41 §4.4). 권한 계산은 조인이
 * 필요하므로 값싼 검사를 먼저 한다. 이력에는 먼저 걸린 코드 하나만 남는다(45 §5.1).
 *
 * <p><b>{@code auth.login.deny-empty-authority} 로 끌 수 있다</b>(기본 {@code true}).
 * 끄면 UX-11 의 권한 없음 화면이 랜딩이 된다 — 로그인 후 권한을 <i>신청</i>하는 흐름을 두는
 * 프로젝트를 위한 것이며 템플릿의 기본 동작은 차단이다.
 *
 * <p><b>이 검사를 켠 채로 부트스트랩 시드에서 역할 부여를 빼면 아무도 들어올 수 없다.</b>
 * {@code 004-init-role.yaml} 이 그 행을 넣고 {@code SeedBootstrapAuthorityTest} 가 지킨다.
 */
@Component
@Order(20)
public class EmptyAuthorityCheck implements LoginPostCheck {

    private final ConfigLookup configs;

    public EmptyAuthorityCheck(ConfigLookup configs) {
        this.configs = configs;
    }

    @Override
    public Optional<LoginResultCode> check(LoginCandidate candidate) {
        // 끌 때는 계산조차 하지 않는다 — 조인 한 번을 아끼는 것이 아니라, 끈 설정이
        // 실제로 아무 일도 하지 않는다는 것을 코드로 보이는 것이다.
        if (!configs.get(AuthLoginProps.class).denyEmptyAuthority()) {
            return Optional.empty();
        }
        return candidate.authority().isEmpty()
                ? Optional.of(LoginResultCode.FAIL_NO_AUTHORITY)
                : Optional.empty();
    }
}
