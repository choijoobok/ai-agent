package com.ordinary.backoffice.support.mail;

import com.ordinary.backoffice.support.config.ConfigLookup;
import com.ordinary.backoffice.support.config.props.MailProps;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.MailSender;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.stereotype.Component;

/**
 * 메일 한 통을 내보낸다 — architecture.md §1 이 알림을 이 모듈에 준 책임이다.
 *
 * <h2>설정만 하면 돈다 — 코드에 스위치가 없다</h2>
 *
 * <p>{@code spring.mail.host} 를 두면 Spring Boot 자동설정이 발송 빈을 만들고 이 클래스가
 * 그것을 찾는다. 두지 않으면 빈이 없고 {@link #send} 는 <b>보내지 못했다</b>고 답한다 —
 * {@code enabled} 플래그를 따로 두지 않는 것이 요점이다: 두면 <i>호스트는 있는데 꺼져 있다</i>
 * 와 <i>켜져 있는데 호스트가 없다</i> 라는 두 가지 조용한 오설정이 생긴다.
 *
 * <p><b>{@code @ConditionalOnBean} 을 쓰지 않는다.</b> 발송 빈은 자동설정이 만들고 그것은
 * 사용자 설정보다 뒤에 평가되므로, 조건을 걸면 있어도 언제나 거짓이 된다 — {@code
 * SecurityConfig.sessionRegistry} 가 같은 함정을 같은 방법으로 피한다.
 *
 * <h2>던지지 않는다 — 보냈는가를 답한다</h2>
 *
 * <p>부르는 쪽이 <b>실패해도 흐름을 멈추지 않는</b> 자리이기 때문이다. 비밀번호 재설정은
 * 발송 성공 여부와 무관하게 같은 응답을 주어야 하고(계정 열거 방지 — 요건서 §6-3), 예외로
 * 알리면 그 규칙을 지키는 책임이 부르는 쪽의 {@code try/catch} 로 흩어진다.
 *
 * <p><b>실패는 여기서 로그로 남긴다.</b> 사용자에게 보이지 않는 실패라 서버 로그가 유일한
 * 흔적이며, 그것이 없으면 <i>"메일이 안 온다" 는 문의에 대고 확인할 것이 아무것도 없다</i>.
 *
 * <h2>본문은 평문이다</h2>
 *
 * <p>HTML 도 템플릿 엔진도 두지 않는다. 나가는 본문은 {@code SYS_MESSAGE} 의 값이며(다국어와
 * 운영 중 수정이 그래서 공짜다) 문구를 조립하는 것은 부르는 쪽이다 — 이 클래스는 업무를
 * 하나도 알지 않는다.
 */
@Component
public class Mailer {

    private static final Logger log = LoggerFactory.getLogger(Mailer.class);

    private final ObjectProvider<MailSender> senders;
    private final ConfigLookup configs;

    public Mailer(ObjectProvider<MailSender> senders, ConfigLookup configs) {
        this.senders = senders;
        this.configs = configs;
    }

    /**
     * @return 발송을 넘겼으면 {@code true}. <b>도달을 뜻하지 않는다</b> — SMTP 가 받은
     *     시점까지이며 그 뒤의 반송은 이 경로로 돌아오지 않는다.
     */
    public boolean send(String to, String subject, String body) {
        MailSender sender = senders.getIfAvailable();
        if (sender == null) {
            log.warn("mail is not configured — set spring.mail.host to enable delivery. to={}", to);
            return false;
        }
        MailProps props = configs.get(MailProps.class);

        SimpleMailMessage message = new SimpleMailMessage();
        // 이름이 비어 있으면 주소만 쓴다 — "<주소>" 앞이 빈 From 은 서버가 거부할 수 있다.
        message.setFrom(props.fromName().isBlank()
                ? props.from()
                : props.fromName() + " <" + props.from() + ">");
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);

        try {
            sender.send(message);
            return true;
        } catch (RuntimeException e) {
            // 본문도 제목도 남기지 않는다 — 재설정 코드가 본문에 있다(architecture.md §6.4 와 같은 이유).
            log.warn("mail delivery failed to={}", to, e);
            return false;
        }
    }
}
