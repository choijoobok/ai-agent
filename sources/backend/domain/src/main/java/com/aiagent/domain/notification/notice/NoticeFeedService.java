package com.aiagent.domain.notification.notice;

import static com.aiagent.domain.notification.notice.NoticeSpec.N;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.search.InChunks;
import com.aiagent.domain.user.entity.QSysUser;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.NotiProps;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.Expression;
import com.querydsl.core.types.Projections;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 공지를 <b>읽는 쪽</b> — 알림 모달의 공지 탭(60 §8)과 로그인 팝업(60 §9).
 *
 * <h2>{@link NoticeQueryService} 와 무엇이 다른가</h2>
 *
 * <p>저쪽은 {@code NOTICE_MGMT} 메뉴의 조회이고 <b>전건을 본다</b> — 내린 것도 예정된 것도
 * 관리자에게는 보여야 한다. 여기는 <b>전 사용자가 부르는 {@code common} 계층</b>이라
 * 조건이 코드에 박혀 있다: 화이트리스트도 조회조건 봉투도 없다(api-conventions.md §3.0 — 동적 조회가
 * 아니다).
 *
 * <p><b>그것이 보안 경계다.</b> 조건을 클라이언트가 주면 내려진 공지를 부를 수 있고, 그
 * 순간 <i>즉시 내림</i>(66 §4.4)이 <b>화면에서만 내려간 것</b>이 된다.
 *
 * <h2>보이는 것의 규칙 — 66 §4.4</h2>
 *
 * <pre>
 * 기본            사용 + 게시 시작이 지났고 + (게시 종료가 없거나 아직 안 지났다)
 * 지난 공지 포함   위에서 마지막 조건만 뺀다
 * 팝업            위 + 팝업 사용 + 팝업 기간 안
 * </pre>
 *
 * <p><b>내림은 어느 쪽에서도 보이지 않는다.</b> <i>"지난 공지"</i> 는 기간이 끝난 것이지
 * 내려진 것이 아니다 — 내림은 <b>목록에서 사라진다</b>.
 *
 * <h2>지금을 한 번만 읽는다</h2>
 *
 * <p>{@link NoticeQueryService} 와 같은 이유다 — 조건과 배지가 <b>같은 순간</b>을 봐야
 * 한다. 여기서는 하나가 더 있다: 팝업은 <i>대상 하나</i> 와 <i>나머지 수</i> 를 두 번
 * 물으므로, 시각이 갈리면 <b>합이 맞지 않는 화면</b>이 나온다.
 */
@Service
@Transactional(readOnly = true)
public class NoticeFeedService {

    private static final QSysUser U = QSysUser.sysUser;

    private static final Expression<?>[] BRIEF = {
        N.noticeId, N.title, N.noticeFromDtm, N.noticeToDtm, N.regId
    };

    private static final Expression<?>[] DETAIL = {
        N.noticeId,
        N.title,
        N.content,
        N.contentTypeCd,
        N.noticeFromDtm,
        N.noticeToDtm,
        N.regId
    };

    private final JPAQueryFactory query;
    private final ConfigLookup configs;
    private final Clock clock;

    public NoticeFeedService(JPAQueryFactory query, ConfigLookup configs, Clock clock) {
        this.query = query;
        this.configs = configs;
        this.clock = clock;
    }

    /**
     * 공지 탭 — 66 §4.2.1 의 정렬 그대로다.
     *
     * <p><b>관리 화면과 같은 순서</b>인 것이 요건이다. 팝업이 <i>이 정렬의 첫 건</i> 을
     * 집으므로(66 §4.2.1) 순서가 갈리면 <i>"팝업에 뜬 공지가 탭 목록의 첫 줄이 아니다"</i>
     * 가 생기고, 그러면 <b>둘이 같은 것을 가리킨다는 전제</b>가 깨진다.
     *
     * @param includeExpired {@code NI-04} 의 <i>"지난 공지 포함"</i>. 기본은 꺼져 있다
     */
    public List<NoticeBrief> findVisible(boolean includeExpired) {
        Instant now = clock.instant();

        List<Tuple> found = query.select(Projections.tuple(BRIEF))
                .from(N)
                .where(visible(now, includeExpired))
                .orderBy(N.sortNo.asc(), N.noticeFromDtm.desc(), N.noticeId.desc())
                .limit(configs.get(NotiProps.class).listSize())
                .fetch();

        Map<String, String> names = namesOf(found.stream().map(row -> row.get(N.regId)).toList());

        List<NoticeBrief> rows = new ArrayList<>(found.size());
        for (Tuple row : found) {
            String regId = row.get(N.regId);
            rows.add(new NoticeBrief(
                    row.get(N.noticeId),
                    row.get(N.title),
                    row.get(N.noticeFromDtm),
                    row.get(N.noticeToDtm),
                    regId,
                    names.getOrDefault(regId, regId),
                    NoticeStatus.resolve(
                            true, row.get(N.noticeFromDtm), row.get(N.noticeToDtm), now)));
        }
        return rows;
    }

    /**
     * 고른 공지 하나 — 본문이 여기서 온다.
     *
     * <p><b>보이는 것만 준다.</b> 번호를 직접 넣어도 내려진 공지는 오지 않으며, 그때 답은
     * <i>권한 없음</i> 이 아니라 <b>없음</b>이다 — 있는지 없는지를 알려 주는 것이 이미
     * 정보다.
     *
     * <p>{@code includeExpired} 를 받는 것은 <b>목록에서 고른 것을 열 수 있어야</b> 하기
     * 때문이다: <i>"지난 공지 포함"</i> 으로 켜서 본 항목을 누르면 상세도 열려야 한다.
     */
    public NoticeDetail findOne(Long noticeId, boolean includeExpired) {
        Instant now = clock.instant();

        Tuple row = query.select(Projections.tuple(DETAIL))
                .from(N)
                .where(N.noticeId.eq(noticeId).and(visible(now, includeExpired)))
                .fetchOne();

        if (row == null) {
            throw new BusinessException(
                    NoticeErrorCode.NOT_FOUND, "보이지 않는 공지다 — " + noticeId);
        }
        return detailOf(row, now);
    }

    /**
     * 로그인 뒤 띄울 것 — 66 §2.4 C안.
     *
     * <p><b>목록 정렬의 첫 건</b>이며 그것이 결정적이어야 한다(66 §4.2.1). 흔들리면
     * <i>"어느 공지가 팝업으로 뜨는가"</i> 가 매 로그인마다 달라진다.
     *
     * <p><b>{@code moreCount} 는 게시중 전건에서 하나를 뺀 수</b>다. 팝업 대상만 세지
     * 않는 것은 링크가 여는 곳이 <b>공지 탭</b>이고 그 탭은 게시중 전부를 보이기 때문이다 —
     * <i>"2건 더 있음"</i> 을 눌렀는데 5건이 있으면 숫자가 거짓말이 된다.
     *
     * <p>세는 것은 <b>목록 상한 밖까지</b>다. 탭 목록은 상한에 걸려 잘릴 수 있지만 그것은
     * 화면이 따로 말하며(<i>최근 N건</i>), 여기서 상한을 반영하면 <b>두 상한이 곱해진다</b>.
     */
    public NoticePopup findPopup() {
        Instant now = clock.instant();

        Tuple row = query.select(Projections.tuple(DETAIL))
                .from(N)
                .where(visible(now, false)
                        .and(N.popupYn.isTrue())
                        .and(N.popupFromDtm.loe(now))
                        .and(N.popupToDtm.goe(now)))
                .orderBy(N.sortNo.asc(), N.noticeFromDtm.desc(), N.noticeId.desc())
                .limit(1)
                .fetchFirst();

        if (row == null) {
            return NoticePopup.none();
        }

        Long active = query.select(N.noticeId.count()).from(N).where(visible(now, false)).fetchOne();
        long more = active == null ? 0L : Math.max(0L, active - 1L);
        return new NoticePopup(detailOf(row, now), more);
    }

    /**
     * 게시중인가 — <b>조건이 한 곳에 있다</b>.
     *
     * <p>탭 · 상세 · 팝업이 같은 표현을 쓴다. 나누면 <i>목록에는 있는데 눌러도 안 열리는</i>
     * 공지가 생기고, 그것은 화면에서 설명할 수 없다.
     *
     * <p><b>사용 여부는 어느 쪽에서도 빠지지 않는다</b> — {@code includeExpired} 가 무르는
     * 것은 <b>종료 조건 하나뿐</b>이다(66 §4.4).
     */
    private static BooleanExpression visible(Instant now, boolean includeExpired) {
        BooleanExpression base = N.useYn.isTrue().and(N.noticeFromDtm.loe(now));
        return includeExpired ? base : base.and(N.noticeToDtm.isNull().or(N.noticeToDtm.goe(now)));
    }

    private NoticeDetail detailOf(Tuple row, Instant now) {
        String regId = row.get(N.regId);
        return new NoticeDetail(
                row.get(N.noticeId),
                row.get(N.title),
                row.get(N.content),
                row.get(N.contentTypeCd),
                row.get(N.noticeFromDtm),
                row.get(N.noticeToDtm),
                regId,
                namesOf(List.of(regId)).getOrDefault(regId, regId),
                NoticeStatus.resolve(true, row.get(N.noticeFromDtm), row.get(N.noticeToDtm), now));
    }

    /**
     * 작성자 ID → 이름.
     *
     * <p>{@code NotiRequestQueryService} 와 같은 방식이다 — 행마다 묻지 않고 페이지의 ID 를
     * 모아 한 번 더 묻는다. 공지를 쓰는 사람은 대개 한둘이라 이 왕복이 싸다.
     *
     * <p><b>못 찾은 것은 빠진다</b>(부르는 쪽이 ID 를 그대로 쓴다). 감사 컬럼에는 FK 가
     * 없으므로(40 §4.2) 이론상 끊어질 수 있고, 이름을 못 찾은 것이 공지를 못 읽을 이유는
     * 아니다.
     */
    private Map<String, String> namesOf(List<String> regIds) {
        List<String> ids = regIds.stream().filter(id -> id != null).distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<String, String> names = new HashMap<>();
        for (List<String> chunk : InChunks.split(ids)) {
            for (Tuple row :
                    query.select(U.userId, U.userNm).from(U).where(U.userId.in(chunk)).fetch()) {
                names.put(row.get(U.userId), row.get(U.userNm));
            }
        }
        return names;
    }
}
