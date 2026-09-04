package com.ordinary.backoffice.api.error;

import com.ordinary.backoffice.api.message.RequestLocale;
import com.ordinary.backoffice.core.error.ErrorCode;
import com.ordinary.backoffice.domain.message.service.MessageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * 응답에 나갈 실패 문구를 완성한다 — architecture.md §6-1.2.
 *
 * <p><b>{@code ErrorCode.code()} 가 곧 메시지 키다.</b> 별도의 매핑표를 두지 않는 것이 이
 * 설계의 요점이며, 그래서 <i>"코드를 추가했는데 문구를 어디 넣는지 모르겠다"</i> 가 생기지
 * 않는다 — {@code MsgKey} 에 상수를 넣으면 시드가 키 행을 만들고 관리 화면이 값을 받는다.
 *
 * <p><b>예외의 {@code getMessage()} 를 쓰지 않는다.</b> 그것은 <b>로그의 것</b>이며 서버
 * 언어로 남아야 한다 — 사용자 언어로 로그를 남기면 같은 사건이 사람마다 다른 문자열로 쌓여
 * {@code SYS_LO_EXCEPTION} 을 문구로 묶을 수 없다. 응답은 <b>사용자 언어</b>이고 그 둘은
 * 다른 축이다.
 */
@Component
public class ErrorMessages {

    private static final Logger log = LoggerFactory.getLogger(ErrorMessages.class);

    private final MessageService messages;
    private final RequestLocale locale;

    public ErrorMessages(MessageService messages, RequestLocale locale) {
        this.messages = messages;
        this.locale = locale;
    }

    /**
     * <b>여기서 던지면 안 된다.</b> 실패를 알리는 경로가 스스로 실패하면 사용자는 봉투 대신
     * 500 HTML 을 받고, 진짜 원인({@code code})은 응답에서 사라진다. DB 가 닿지 않는 것이
     * 바로 그 상황이므로 <b>이 자리에서만</b> 예외를 삼키고 폴백 문구로 간다.
     */
    public String of(ErrorCode errorCode) {
        try {
            return messages
                    .find(errorCode.code(), locale.current())
                    .orElseGet(errorCode::defaultMessage);
        } catch (RuntimeException e) {
            log.warn("메시지를 읽지 못해 폴백 문구로 응답한다 code={}", errorCode.code(), e);
            return errorCode.defaultMessage();
        }
    }
}
