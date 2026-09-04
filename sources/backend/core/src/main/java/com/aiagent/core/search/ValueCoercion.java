package com.aiagent.core.search;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * 와이어 값 → 컬럼의 자바 타입.
 *
 * <p>JSON 이 주는 것은 문자열·숫자·불리언뿐인데 컬럼은 {@code OffsetDateTime} 이거나 열거형이다.
 * <b>바인딩 전에 여기서 맞춘다</b> — 맞추지 않으면 QueryDSL 이 {@code Object} 를 그대로 상수로
 * 만들고 드라이버가 벤더마다 다르게 실패한다.
 *
 * <p><b>느슨하게 읽지 않는다.</b> 읽을 수 없으면 400 이며, 조용히 {@code null} 로 떨어뜨리면
 * <i>"조건을 넣었는데 안 걸린다"</i> 가 된다 — api-conventions.md §3.3 이 {@code isNull} 에 대해 한 판단과 같다.
 *
 * <p><b>{@code ynFlag} 는 {@code 'Y'}/{@code 'N'} 과 {@code true}/{@code false} 를 둘 다 받는다.</b>
 * DB 는 {@code CHAR(1)} 이고(db-portability.md §4.3) 자바 필드는 {@code Boolean} 이라(컨버터) 화면이 어느
 * 쪽을 보내도 뜻이 하나다.
 */
final class ValueCoercion {

    static List<?> list(Object raw, String field) {
        if (raw instanceof List<?> values) {
            return values;
        }
        throw SearchErrors.notAList(field);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    static Object one(Object raw, Class<?> type, String field) {
        if (raw == null) {
            throw SearchErrors.uncoercible(null, type, field);
        }
        if (type.isInstance(raw)) {
            return raw;
        }
        try {
            if (type.isEnum()) {
                return Enum.valueOf((Class<Enum>) type, raw.toString());
            }
            if (type == String.class) {
                return raw.toString();
            }
            if (type == Boolean.class || type == boolean.class) {
                return bool(raw, field);
            }
            if (type == Integer.class || type == int.class) {
                return number(raw, field).intValueExact();
            }
            if (type == Long.class || type == long.class) {
                return number(raw, field).longValueExact();
            }
            if (type == Short.class || type == short.class) {
                return number(raw, field).shortValueExact();
            }
            if (type == Double.class || type == double.class) {
                return number(raw, field).doubleValue();
            }
            if (type == BigDecimal.class) {
                return number(raw, field);
            }
            if (type == BigInteger.class) {
                return number(raw, field).toBigIntegerExact();
            }
            if (type == OffsetDateTime.class) {
                return OffsetDateTime.parse(raw.toString());
            }
            /*
              이력 테이블의 시각 컬럼이 {@code Instant} 다(45 §4.1). 화면은 오프셋을 포함한
              ISO-8601 을 보내므로(architecture.md §6-1) {@code OffsetDateTime} 으로 읽어 순간으로 바꾼다 —
              {@code Instant.parse} 는 {@code Z} 만 받아 {@code +09:00} 에서 죽는다.
            */
            if (type == Instant.class) {
                return OffsetDateTime.parse(raw.toString()).toInstant();
            }
            if (type == LocalDateTime.class) {
                return LocalDateTime.parse(raw.toString());
            }
            if (type == LocalDate.class) {
                return LocalDate.parse(raw.toString());
            }
            if (type == LocalTime.class) {
                return LocalTime.parse(raw.toString());
            }
            if (type == Character.class || type == char.class) {
                String text = raw.toString();
                if (text.length() != 1) {
                    throw SearchErrors.uncoercible(raw, type, field);
                }
                return text.charAt(0);
            }
        } catch (ArithmeticException | NumberFormatException | DateTimeParseException e) {
            throw SearchErrors.uncoercible(raw, type, field);
        } catch (IllegalArgumentException e) {
            // 열거형에 없는 이름. 다른 IllegalArgumentException 과 섞이지 않는다 —
            // 위 분기 중 이것을 던지는 것은 Enum.valueOf 뿐이다.
            throw SearchErrors.uncoercible(raw, type, field);
        }
        throw SearchErrors.uncoercible(raw, type, field);
    }

    private static BigDecimal number(Object raw, String field) {
        if (raw instanceof Number n) {
            return new BigDecimal(n.toString());
        }
        try {
            return new BigDecimal(raw.toString().trim());
        } catch (NumberFormatException e) {
            throw SearchErrors.uncoercible(raw, Number.class, field);
        }
    }

    private static Boolean bool(Object raw, String field) {
        if (raw instanceof Boolean b) {
            return b;
        }
        String text = raw.toString();
        if ("Y".equalsIgnoreCase(text) || "true".equalsIgnoreCase(text)) {
            return Boolean.TRUE;
        }
        if ("N".equalsIgnoreCase(text) || "false".equalsIgnoreCase(text)) {
            return Boolean.FALSE;
        }
        throw SearchErrors.uncoercible(raw, Boolean.class, field);
    }

    private ValueCoercion() {}
}
