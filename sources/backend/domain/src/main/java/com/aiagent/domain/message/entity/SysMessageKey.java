package com.aiagent.domain.message.entity;

import com.aiagent.core.domain.BaseAuditEntity;
import com.aiagent.domain.message.MessageScope;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 메시지 키 — <b>코드가 소유한다</b>(43 §7 · ADR-0023 §3).
 *
 * <p>테이블이 {@link SysMessage} 와 갈린 축은 <b>소유</b>다. 이 행은 {@code generateMessageSeed}
 * 가 소스 상수에서 만들고 사람은 손대지 않으며, 값 행은 그 반대다. 한 테이블에 두 소유가
 * 섞여 있던 것이 {@code MSG_GRP_CD} 부분 함수 종속의 원인이었다.
 *
 * <p><b>이 행이 곧 관리 화면의 마스터 행이다</b>(63 §3.2) — 값이 하나도 없는 키도 행으로
 * 존재하므로 <i>"키만 있는 행"</i> 을 위한 예외가 필요 없다.
 */
@Entity
@Table(name = "SYS_MESSAGE_KEY")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysMessageKey extends BaseAuditEntity {

    @Id
    @Column(name = "MSG_KEY", length = 200, nullable = false)
    private String msgKey;

    /**
     * <b>문자열이 아니라 enum 으로 매핑한다.</b> 모르는 값이 들어오면 조회가 그 자리에서
     * 죽는다 — 조용히 {@code NONE} 으로 접으면 <b>죽은 키 판정이 거짓을 말한다</b>.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "USE_SCOPE", length = 10, nullable = false)
    private MessageScope useScope;

    /** 상수의 Javadoc 에서 온다. 번역하는 사람이 보는 유일한 맥락이다(ADR-0023 §2). */
    @Column(name = "MSG_DESC", length = 500)
    private String msgDesc;

    /**
     * 관리 화면이 만드는 키 — 63 §3.2. <b>{@code USE_SCOPE} 를 받지 않는다.</b>
     *
     * <p>화면에서 추가한 키는 <b>즉시 {@code NONE}</b>(미사용)이다. 소스 상수에 없으므로
     * 그것이 사실이며, 다음 {@code generateMessageSeed} 가 상수에서 찾으면 사용처가 바뀐다 —
     * 동기화가 {@code USE_SCOPE} 를 전건 재계산하기 때문이다(ADR-0023 §2).
     *
     * <p><b>인자로 열어 두면 화면이 자기를 {@code BOTH} 라고 말할 수 있다.</b> 시드가 소유한
     * 컬럼이므로 받을 경로 자체를 두지 않는다(43 §4.4 가 {@code DTL_NM} 에 쓴 방식과 같다).
     */
    public static SysMessageKey created(String msgKey) {
        SysMessageKey entity = new SysMessageKey();
        entity.msgKey = msgKey;
        entity.useScope = MessageScope.NONE;
        return entity;
    }

    /**
     * <b>데이터가 만드는 키</b> — {@code code.*}(43 §4.4 · 63 §2.3 · ADR-0023 §4).
     *
     * <p>{@link #created} 와 갈라 두는 것이 요점이다. 저것은 사람이 만든 키라 소스에 없다는
     * 사실이 곧 {@link MessageScope#NONE} 인데, 이 키는 <b>코드 행이 있는 한 살아 있는
     * 키</b>이며 소스에 상수가 없는 것이 정상이다 — 같은 {@code NONE} 으로 만들면 죽은 키
     * 목록이 코드 수만큼 부풀고, {@code generateMessageSeed} 는 {@code code.} 접두를 아예
     * 건드리지 않으므로 <b>다음 생성도 그것을 고쳐 주지 않는다</b>(seed-generation.md §2.1).
     */
    public static SysMessageKey dataKey(String msgKey) {
        SysMessageKey entity = new SysMessageKey();
        entity.msgKey = msgKey;
        entity.useScope = MessageScope.DATA;
        return entity;
    }
}
