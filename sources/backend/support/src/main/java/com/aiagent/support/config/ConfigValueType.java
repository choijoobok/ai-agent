package com.aiagent.support.config;

import java.util.Collection;
import java.util.Map;

/**
 * 설정값의 유형 — screen/config/requirements.md. <b>원천은 필드 타입이다</b>({@code CFG_TYPE_CD} 가 아니다).
 *
 * <p>화면이 아는 것은 <b>여기까지</b>다. {@code @Min} · {@code @Max} · 상호 제약은 화면이
 * 복제하지 않는다 — 제약의 단일 원본은 바인딩 객체이고(sys/code.md) 옮겨 적으면 원본이 둘이
 * 되어 <b>어긋날 때 어느 쪽이 맞는지 알 수 없다</b>(screen/config/requirements.md).
 *
 * <p>넷뿐인 것이 요점이다. 자바 타입을 그대로 내면 화면이 {@code java.lang.Integer} 를
 * 알아야 하고, 그것은 <b>서버의 구현을 화면 계약에 새기는 것</b>이다.
 */
public enum ConfigValueType {

    /** 문자열 — 화면이 형식을 검사하지 않는다. */
    STRING,

    /** 정수·실수. 화면이 <b>문자를 막는다</b>(frontend/grid.md). */
    NUMBER,

    /** {@code true}/{@code false}. 화면이 그 둘 아닌 값을 막는다. */
    BOOLEAN,

    /**
     * 컬렉션을 한 칸에 담은 문자열 — sys/batch.md 가 쓰는 방식이다.
     *
     * <p><b>{@code Map}·{@code List} 프로퍼티는 목록에 나오지 않는다</b>(screen/config/requirements.md) — 맵의
     * 키가 곧 프로퍼티 이름이라 키가 하나로 고정되지 않는다. 컬렉션이 필요하면
     * {@code JSON} 문자열 <b>한 칸</b>으로 선언한다.
     */
    JSON;

    /**
     * 자바 타입 → 유형.
     *
     * <p><b>{@code null} 이면 목록에 내지 않는다</b> — 스칼라가 아니라는 뜻이다. 컬렉션과
     * 맵이 그렇고, 우리 패키지의 중첩 객체는 여기 오기 전에 재귀로 펴진다.
     */
    public static ConfigValueType of(Class<?> type) {
        if (type == boolean.class || type == Boolean.class) {
            return BOOLEAN;
        }
        if (type.isPrimitive() || Number.class.isAssignableFrom(type)) {
            // char 는 숫자가 아니다 — 아래 STRING 으로 떨어뜨린다.
            return type == char.class ? STRING : NUMBER;
        }
        if (Collection.class.isAssignableFrom(type) || Map.class.isAssignableFrom(type)) {
            return null;
        }
        if (type == String.class || type.isEnum() || type == Character.class) {
            return STRING;
        }
        return null;
    }
}
