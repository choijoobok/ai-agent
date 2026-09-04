package com.aiagent.domain.message;

/**
 * {@code SYS_MESSAGE_KEY.USE_SCOPE} — <b>누가 이 키를 쓰는가</b>(43 §7.1 · ADR-0023 §4).
 *
 * <p><b>번들 여부를 컬럼으로 두지 않는다.</b> 그것은 이 값의 함수이고({@link #bundled()}),
 * 컬럼으로 저장하면 같은 사실의 원천이 둘이 되어 어긋났을 때 어느 쪽이 맞는지 판정할 근거가
 * 없다.
 *
 * <p><b>{@link #NONE} 이 죽은 키다.</b> 소스 어디에도 상수가 없다는 뜻이며, 시드가 행을
 * 지우지 않고 이 값으로 표시만 한다 — 지우면 딸려 있는 번역이 사라진다(ADR-0023 §2).
 */
public enum MessageScope {

    /** 프론트 {@code MSG} 에만 있다. */
    FRONT,

    /** 백엔드 {@code MsgKey} 에만 있다. 에러 문구는 서버가 완성하므로 번들에 없다(architecture.md §6-1.2). */
    BACK,

    /** 양쪽에 있다. */
    BOTH,

    /**
     * 데이터가 만드는 키 — {@code menu.*} · {@code code.*}(43 §4.4).
     *
     * <p><b>생성 시드가 이 접두를 건드리지 않는다.</b> 잊으면 그 키 전부가 {@link #NONE}
     * 으로 떨어져 죽은 키로 잡힌다(seed-generation.md §2.1).
     */
    DATA,

    /** 양쪽에서 못 찾았다 — 죽은 키. 고치는 곳은 "지우거나, 쓰기 시작하거나" 다. */
    NONE;

    /** 공개 번들에 실리는가 — 경계는 곧 <b>프론트가 쓰는가</b> 다(50 §3.2). */
    public boolean bundled() {
        return this == FRONT || this == BOTH || this == DATA;
    }
}
