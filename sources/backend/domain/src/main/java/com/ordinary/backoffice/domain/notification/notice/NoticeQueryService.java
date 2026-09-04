package com.ordinary.backoffice.domain.notification.notice;

import static com.ordinary.backoffice.domain.notification.notice.NoticeSpec.N;

import com.ordinary.backoffice.core.error.BusinessException;
import com.ordinary.backoffice.core.search.PageMode;
import com.ordinary.backoffice.core.search.PageResponse;
import com.ordinary.backoffice.core.search.SearchRequest;
import com.ordinary.backoffice.domain.notification.entity.SysNotice;
import com.ordinary.backoffice.domain.notification.repository.SysNoticeRepository;
import com.ordinary.backoffice.domain.search.Built;
import com.ordinary.backoffice.domain.search.QueryDslBuilder;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.Expression;
import com.querydsl.core.types.Projections;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code NOTICE_MGMT} 의 조회 — 66 §4.2 · §4.4.
 *
 * <h2>{@code CONTENT} 를 목록이 싣는다</h2>
 *
 * <p>{@code nclob} 인데 {@code SELECT} 한다. 64 §2.4 가 이력에서 <i>전문을 목록에 싣지
 * 않는다</i> 고 한 것과 갈리는데, 근거가 양이었기 때문이다 — 이력은 수천만 행이고 공지는
 * 수백 건이며 <b>페이지 사이즈가 20</b> 이다(66 §3.3).
 *
 * <p>그리고 여기서는 <b>본문이 편집 대상</b>이다. 별도 조회로 빼면 {@code textModal} 을
 * 열 때마다 왕복이 하나 늘고, 그 왕복은 <i>편집하려고 여는</i> 동작마다 난다.
 *
 * <h2>파생이 하나다 — 게시 상태</h2>
 *
 * <p>{@link NoticeStatus#of} 가 계산하며 <b>조회조건의 파생과 같은 규칙</b>을 쓴다
 * ({@link NoticeSpec}). 나누면 <i>배지는 게시중인데 게시중으로 걸러도 안 나오는</i>
 * 행이 생긴다.
 */
@Service
@Transactional(readOnly = true)
public class NoticeQueryService {

    private static final Expression<?>[] LIST = {
        N.sortNo,
        N.noticeId,
        N.title,
        N.content,
        N.noticeFromDtm,
        N.noticeToDtm,
        N.useYn,
        N.popupYn,
        N.popupFromDtm,
        N.popupToDtm,
        N.regId,
        N.regDtm,
        N.modId,
        N.modDtm
    };

    private final JPAQueryFactory query;
    private final QueryDslBuilder builder;
    private final SysNoticeRepository notices;
    private final NoticeSpec spec;
    private final Clock clock;

    public NoticeQueryService(
            JPAQueryFactory query,
            QueryDslBuilder builder,
            SysNoticeRepository notices,
            NoticeSpec spec,
            Clock clock) {
        this.query = query;
        this.builder = builder;
        this.notices = notices;
        this.spec = spec;
        this.clock = clock;
    }

    /** 마스터 목록 — 기본 정렬이 {@code SORT_NO, NOTICE_FROM_DTM DESC, NOTICE_ID DESC} 다. */
    public PageResponse<NoticeRow> getList(SearchRequest<Void> request) {
        Built built = builder.build(request, spec.spec(), PageMode.offset);

        List<Tuple> found = built.apply(query.select(Projections.tuple(LIST))).fetch();
        Long total = built.count(query).fetchOne();

        /*
          **한 번 읽은 시각을 페이지 전체에 쓴다.** 행마다 clock.instant() 를 부르면
          경계에 걸친 공지가 같은 응답 안에서 예정과 게시중으로 갈릴 수 있고, 그것은
          화면에서 설명할 수 없는 상태다.
        */
        Instant now = clock.instant();

        List<NoticeRow> rows = new ArrayList<>(found.size());
        for (Tuple row : found) {
            Boolean useYn = row.get(N.useYn);
            Instant from = row.get(N.noticeFromDtm);
            Instant to = row.get(N.noticeToDtm);
            rows.add(new NoticeRow(
                    row.get(N.sortNo),
                    row.get(N.noticeId),
                    row.get(N.title),
                    row.get(N.content),
                    from,
                    to,
                    NoticeStatus.resolve(Boolean.TRUE.equals(useYn), from, to, now),
                    useYn,
                    row.get(N.popupYn),
                    row.get(N.popupFromDtm),
                    row.get(N.popupToDtm),
                    row.get(N.regId),
                    row.get(N.regDtm),
                    row.get(N.modId),
                    row.get(N.modDtm)));
        }
        return built.respond(rows, total == null ? 0L : total);
    }

    /** 저장·삭제가 대상을 집는 자리 — 없으면 화면이 낡았거나 화면 밖 경로다. */
    public SysNotice require(Long noticeId) {
        return notices.findById(noticeId)
                .orElseThrow(() -> new BusinessException(
                        NoticeErrorCode.NOT_FOUND, "없는 공지다 — " + noticeId));
    }
}
