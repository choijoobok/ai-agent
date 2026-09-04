package com.ordinary.backoffice.api.auth;

import com.ordinary.backoffice.api.auth.response.PasswordPolicyResponse;
import com.ordinary.backoffice.api.message.RequestLocale;
import com.ordinary.backoffice.core.message.MsgFormat;
import com.ordinary.backoffice.core.message.MsgKey;
import com.ordinary.backoffice.domain.message.service.MessageService;
import com.ordinary.backoffice.support.config.ConfigLookup;
import com.ordinary.backoffice.support.config.props.AuthPasswordProps;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 비밀번호 규칙 목록을 조립한다 — {@code docs/screen/pwd-change/requirements.md} §6-2.
 *
 * <h2>서버가 <b>실제로 판정하는 것만</b> 낸다</h2>
 *
 * <p>요건서의 예시 JSON 은 규칙 다섯을 그리지만 {@code NO_REPEAT}(연속 문자)와
 * {@code NO_LOGIN_ID}(아이디 포함)는 <b>이 저장소에 구현도 설정 키도 없다</b> —
 * {@code PasswordRules} 가 <i>"정책이 가진 축은 길이와 문자 종류 둘뿐이며, 여기에만 있는
 * 규칙을 더하면 설정으로 끌 수 없는 규칙이 생긴다"</i> 고 적어 두었고, 그 두 규칙의 설정
 * 키는 강제 변경 요건서 §9 에 <b>아직 미결</b>로 남아 있다.
 *
 * <p><b>없는 규칙을 목록에 넣는 것이 최악이다.</b> 화면이 그 규칙으로 체크리스트를 그리면
 * 사용자는 <i>지키지 않아도 통과하는 규칙</i> 을 지키게 되고, 서버가 잡아 주지 않으므로
 * 그 사실은 아무 데서도 드러나지 않는다. 규칙이 늘어나는 날 <b>여기 한 줄</b>이 는다 —
 * 프론트는 모르는 식별자를 건너뛰므로 그 순서로 배포해도 안전하다(§6-2).
 *
 * <h2>{@code @Component} 이고 {@code Service} 가 아니다</h2>
 *
 * <p>DB 를 읽지 않고 트랜잭션도 열지 않는다 — 설정과 문구를 응답 모양으로 옮기는 것이
 * 전부다. {@code QueryService} 로 이름 붙이면 {@code ServiceConventionTest} 가 클래스 레벨
 * {@code readOnly} 를 요구하고, 그것은 <b>없는 트랜잭션을 선언하는</b> 일이 된다.
 */
@Component
public class PasswordPolicies {

    private final MessageService messages;
    private final RequestLocale locale;
    private final ConfigLookup configs;

    public PasswordPolicies(
            MessageService messages, RequestLocale locale, ConfigLookup configs) {
        this.messages = messages;
        this.locale = locale;
        this.configs = configs;
    }

    /**
     * <p><b>{@code reuseBlockCount} 가 0 이면 그 규칙을 내지 않는다.</b> 0 은 <i>재사용을
     * 막지 않는다</i> 는 뜻이라({@code AuthPasswordProps}) 목록에 남기면 화면이
     * <i>"최근 0개와 같은 비밀번호는 쓸 수 없습니다"</i> 를 그린다.
     */
    public PasswordPolicyResponse current() {
        AuthPasswordProps policy = configs.get(AuthPasswordProps.class);
        String lang = locale.current();

        List<PasswordPolicyResponse.Rule> rules = new ArrayList<>();
        rules.add(rule(
                "MIN_LENGTH", Map.of("min", policy.minLength()), true,
                MsgKey.PWD_RULE_MIN_LENGTH, lang));
        rules.add(rule(
                "CHARSET_KINDS", Map.of("kinds", policy.requireCharsetKinds()), true,
                MsgKey.PWD_RULE_CHARSET_KINDS, lang));

        if (policy.reuseBlockCount() > 0) {
            // 과거 해시를 내려보낼 수 없으므로 원리상 서버 전용이다 — 프론트가 건너뛴다.
            rules.add(rule(
                    "NO_REUSE", Map.of("count", policy.reuseBlockCount()), false,
                    MsgKey.PWD_RULE_NO_REUSE, lang));
        }
        return new PasswordPolicyResponse(
                List.copyOf(rules),
                new PasswordPolicyResponse.Reset(
                        policy.reset().tokenValidMinutes(),
                        policy.reset().requestCooldownSeconds()));
    }

    /**
     * 문구는 <b>여기서 완성된다</b> — 번역과 인자 치환 둘 다.
     *
     * <p>프론트에 {@code {min}} 을 남긴 채 보내면 치환 규칙이 두 곳에 생기고, 번역자는
     * 어느 쪽 문법으로 쓸지 알 수 없게 된다({@code MsgFormat} 의 존재 이유).
     */
    private PasswordPolicyResponse.Rule rule(
            String id, Map<String, Object> params, boolean clientCheckable, String msgKey,
            String lang) {
        return new PasswordPolicyResponse.Rule(
                id, params, clientCheckable,
                MsgFormat.format(messages.text(msgKey, lang), params));
    }
}
