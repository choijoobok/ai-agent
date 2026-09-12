package com.aiagent.domain.notification.notice;

import com.aiagent.core.search.Op;
import com.aiagent.core.search.QuerySpec;
import com.aiagent.core.search.SortDir;
import com.aiagent.domain.notification.entity.QSysNotice;
import com.querydsl.core.types.dsl.BooleanExpression;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * {@code NOTICE_MGMT} 의 화이트리스트 — screen/notice/requirements.md · backend/api.md.
 *
 * <h2><b>정적 상수가 아니라 빈이다</b> — 이 문서군에서 처음이다</h2>
 *
 * <p>다른 스펙은 전부 {@code public static final QuerySpec SPEC} 이다. 여기가 갈리는
 * 이유는 하나다 — <b>{@code 게시 상태} 파생 조건이 <i>지금</i> 을 필요로 한다.</b>
 *
 * <p>그리고 <i>지금</i> 은 DB 가 줄 수 없다: backend/persistence.md 가 {@code SYSDATE}·{@code NOW()} 를
 * <b>애플리케이션에서 값 주입</b>으로 못박았다(4벤더 무수정 기동이 그 대가다). 주입받은
 * {@link Clock} 을 정적 초기화식에서 볼 방법이 없으므로 스펙이 빈이 된다.
 *
 * <p><b>다른 스펙까지 빈으로 바꾸지 않는다.</b> 필요가 없는데 바꾸면 정적 상수로 충분한
 * 것들까지 컨텍스트에 의존하게 되고, 스펙 하나를 읽으려고 스프링을 띄워야 한다.
 *
 * <h2>기간이 필수가 아니다</h2>
 *
 * <p>screen/admin/system/log/access/requirements.md 의 <i>기간 필수 + 상한</i> 을 상속하지 않는다(screen/notice/requirements.md) — 근거가 대용량인데
 * 공지는 수백 건이다. screen/batch/schedule/requirements.md 이 배치 등록에 내린 것과 같은 판단이다.
 *
 * <h2>본문이 없다</h2>
 *
 * <p>{@code CONTENT} 는 {@code nclob} 이라 조건으로도 정렬로도 쓸 수 없다 — Oracle 이
 * {@code CLOB} 의 {@code ORDER BY} 를 막고(backend/api.md), {@code LIKE} 는 인덱스를 못 타면서
 * <b>되는 것처럼 보인다</b>. {@code BatchHistorySpec} 의 {@code ERR_MSG} 와 같은 자리다.
 */
@Component
public class NoticeSpec {

    static final QSysNotice N = QSysNotice.sysNotice;

    private final Clock clock;
    private final QuerySpec spec;

    public NoticeSpec(Clock clock) {
        this.clock = clock;
        this.spec = QuerySpec.of("notice")
                .from(N)
                .col("title", N.title)
                // 게시 기간 — 조회조건의 between 이자 기본 정렬의 둘째 키다(screen/notice/requirements.md).
                .col("noticeFromDtm", N.noticeFromDtm).sortable()
                .col("popupYn", N.popupYn)
                // 사람이 정한 순서. 팝업이 이 정렬의 첫 건을 집는다(screen/notice/requirements.md C안).
                .col("sortNo", N.sortNo).sortable()
                .col("noticeId", N.noticeId)
                .derived("noticeStat", this::noticeStat)
                .defaultSort("sortNo", SortDir.asc)
                .defaultSort("noticeFromDtm", SortDir.desc)
                .defaultSort("noticeId", SortDir.desc)
                .pk(N.noticeId)
                .build();
    }

    public QuerySpec spec() {
        return spec;
    }

    /**
     * {@code 게시 상태} — 파생 조건의 <b>다섯째 사례</b>다({@code AccessLogSpec.outcome} ·
     * {@code LoginLogSpec.rsltGroup} · {@code ErrorLogSpec.statusGroup} ·
     * {@code BatchHistorySpec.rsltGroup} 다음).
     *
     * <p>앞의 넷과 다른 점이 둘이다. <b>{@code in} 을 받는다</b> — 넷은 전부 {@code eq}
     * 하나였는데 여기는 화면 기본값이 <i>세 개 선택</i>이다(screen/notice/requirements.md — {@code DOWN} 을 뺀
     * 셋). 그리고 <b>값이 컬럼이 아니라 시각과의 관계</b>다.
     *
     * <p><b>모르는 값을 조용히 전체로 흘리지 않는다</b> — {@code ErrorLogSpec} 과 같은
     * 규칙이다. 흘려보내면 <b>거르지 않은 목록을 거른 것으로 읽는다</b>.
     */
    private BooleanExpression noticeStat(Op op, Object value) {
        if (op != Op.eq && op != Op.in) {
            throw new IllegalArgumentException("게시 상태는 = 와 in 만 받는다 — " + op);
        }
        List<NoticeStatus> wanted = parse(value);
        if (wanted.isEmpty()) {
            throw new IllegalArgumentException("게시 상태가 비어 있다");
        }

        Instant now = clock.instant();
        BooleanExpression predicate = null;
        for (NoticeStatus status : wanted) {
            BooleanExpression one = expressionOf(status, now);
            predicate = predicate == null ? one : predicate.or(one);
        }
        return predicate;
    }

    /**
     * 상태 하나를 조건으로 — {@link NoticeStatus#resolve} 와 <b>같은 규칙을 SQL 로</b> 편다.
     *
     * <p>둘이 갈리면 <i>배지는 게시중인데 게시중으로 걸러도 안 나오는</i> 행이 생긴다.
     * 자바 쪽이 순서로 표현한 우선순위(내림이 기간을 이긴다)를 여기서는
     * <b>{@code USE_YN} 조건을 함께 걸어</b> 표현한다.
     */
    private static BooleanExpression expressionOf(NoticeStatus status, Instant now) {
        BooleanExpression up = N.useYn.isTrue();
        return switch (status) {
            case DOWN -> N.useYn.isFalse();
            case SCHEDULED -> up.and(N.noticeFromDtm.gt(now));
            case EXPIRED -> up.and(N.noticeToDtm.isNotNull()).and(N.noticeToDtm.lt(now));
            case ACTIVE -> up.and(N.noticeFromDtm.loe(now))
                    .and(N.noticeToDtm.isNull().or(N.noticeToDtm.goe(now)));
        };
    }

    /** {@code eq} 는 값 하나, {@code in} 은 목록이다 — backend/api.md. */
    private static List<NoticeStatus> parse(Object value) {
        List<NoticeStatus> parsed = new ArrayList<>();
        if (value instanceof Collection<?> values) {
            for (Object one : values) {
                parsed.add(toStatus(one));
            }
            return parsed;
        }
        parsed.add(toStatus(value));
        return parsed;
    }

    private static NoticeStatus toStatus(Object raw) {
        String name = String.valueOf(raw);
        for (NoticeStatus status : NoticeStatus.values()) {
            if (status.name().equalsIgnoreCase(name)) {
                return status;
            }
        }
        throw new IllegalArgumentException("게시 상태가 아니다 — " + name);
    }
}
