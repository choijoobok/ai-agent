package com.aiagent.core.search;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.ErrorCode;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * 기간은 <b>필수 조건이고 상한이 있다</b> — 64 §2.2.
 *
 * <p>이력 화면 셋에 공통인 규칙이다. 사용 이력이 먼저 필요로 했고 로그인 이력이 <b>같은
 * 것을 다시</b> 필요로 하면서 여기로 나왔다 — 에러 로그가 셋째다.
 *
 * <h2>왜 화면 층만으로 부족한가</h2>
 *
 * <p>폼도 같은 것을 막지만(search-form-contract.md §3.4의 {@code required}) <b>막는 이유가 편의가 아니라
 * 부하</b>다. 화면만 막으면 도구·스크립트가 그대로 지나가고, 조건 없는 첫 조회가 보존
 * 기간 전량을 향한다.
 *
 * <h2>조건 하나가 다른 조건의 필수 여부를 바꾼다</h2>
 *
 * <p>{@link Rule#bypassField} 가 그것이다. 추적 ID 에는 별도 인덱스가 있으므로(45 §4.1)
 * 기간 없이도 인덱스를 타며, 그때는 기간이 <b>선택</b>이 된다 — 72 프로토콜에 없던 모양이라
 * 64 §2.2 가 입력으로 적어 두었다.
 *
 * <h2>여기에 문구가 없다</h2>
 *
 * <p>{@link ErrorCode} 를 화면이 들고 온다. 이력 셋이 같은 <b>규칙</b>을 공유하지만
 * 사용자에게 나가는 문구는 화면의 것이며(<i>"사용 이력은 90일"</i> 과 <i>"로그인 이력은
 * 1년"</i> 은 다른 말이다), 여기서 문구까지 정하면 그 차이를 낼 자리가 사라진다.
 */
public final class RangeGuard {

    /**
     * @param field 기간 조건의 필드명 — 이력 셋 모두 {@code creDtm} 이다
     * @param bypassField 이 조건이 있으면 기간이 <b>선택</b>이 된다. 없으면 {@code null}
     * @param maxDays 상한. <b>화면 층과 시스템 값 중 좁은 쪽</b>을 부르는 쪽이 이미 고른다 —
     *     화면은 <i>더 좁게</i> 만 갈 수 있다(64 §2.2)
     */
    public record Rule(
            String field, String bypassField, int maxDays, ErrorCode required, ErrorCode tooWide) {}

    /**
     * 통과하지 못하면 <b>400 이다</b>.
     *
     * <p>조용히 자르지 않는다 — 잘라 주면 사용자는 <i>"상한만큼 봤다"</i> 고 믿은 채 더 넓은
     * 기간의 결론을 낸다.
     */
    public static void check(SearchRequest<?> request, Rule rule) {
        Condition range = null;
        boolean bypassed = false;

        for (Condition condition : request.conditionsOrEmpty()) {
            if (rule.field().equals(condition.field()) && condition.op() == Op.between) {
                range = condition;
            }
            if (condition.field().equals(rule.bypassField())) {
                bypassed = true;
            }
        }
        if (range == null) {
            if (bypassed) {
                return;
            }
            throw new BusinessException(
                    rule.required(), "조회 기간이 없다 — 보존 기간 전량을 향한다");
        }
        checkWidth(range, rule);
    }

    /**
     * 한쪽이 열린 범위(api-conventions.md §3.3 의 단측)도 <b>상한을 넘은 것으로 본다</b> — 열린 쪽이 곧
     * 무제한이며, 그것이 이 검사가 막으려던 바로 그 조회다.
     */
    private static void checkWidth(Condition range, Rule rule) {
        List<?> pair = range.value() instanceof List<?> values ? values : List.of();
        Instant from = pair.size() == 2 ? instant(pair.get(0)) : null;
        Instant to = pair.size() == 2 ? instant(pair.get(1)) : null;

        if (from == null || to == null || Duration.between(from, to).toDays() > rule.maxDays()) {
            throw new BusinessException(
                    rule.tooWide(), "조회 기간이 " + rule.maxDays() + "일을 넘었다");
        }
    }

    /**
     * 값이 읽히지 않으면 {@code null} 이다 — <b>여기서 400 을 던지지 않는다</b>.
     *
     * <p>{@link #checkWidth} 가 그 {@code null} 을 <i>상한 초과</i> 로 다루고, 형태가 정말
     * 틀렸다면 곧이어 {@code QueryDslBuilder} 가 자기 코드로 400 을 낸다 — 같은 실패에
     * 문구를 둘 두지 않는다.
     */
    private static Instant instant(Object value) {
        try {
            return value == null ? null : OffsetDateTime.parse(value.toString()).toInstant();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private RangeGuard() {}
}
