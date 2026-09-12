// @feat FEAT-509
package com.aiagent.domain.notification.notice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Answers.RETURNS_SELF;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.grid.RowState;
import com.aiagent.domain.notification.repository.SysNoticeRepository;
import com.aiagent.support.config.ConfigLookup;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.Expression;
import com.querydsl.core.types.Predicate;
import com.querydsl.jpa.impl.JPAQuery;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.time.Instant;
import java.time.Clock;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class NoticeServiceTest {

    private SysNoticeRepository notices;
    private NoticeService service;

    @BeforeEach
    void setUp() {
        notices = mock(SysNoticeRepository.class);
        service = new NoticeService(notices, mock(NoticeQueryService.class));
    }

    @Test
    @DisplayName("TC-5092 종료가 시작보다 이른 공지는 저장 전에 거부하고 행을 남기지 않는다")
    void rejectsReversedNoticePeriodWithoutWriting() {
        NoticeSaveRow reversed = new NoticeSaveRow(
                RowState.C,
                null,
                "점검 안내",
                "서비스 점검이 있습니다.",
                Instant.parse("2026-09-15T00:00:00Z"),
                Instant.parse("2026-09-14T23:59:59Z"),
                false,
                null,
                null,
                true,
                0);

        assertThatThrownBy(() -> service.save(List.of(reversed)))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(NoticeErrorCode.PERIOD_INVALID);
        verify(notices, never()).save(any());
    }

    @Test
    @DisplayName("TC-5093 팝업 기간 밖 공지는 조회 조건에서 제외되어 미노출이다")
    @SuppressWarnings("unchecked")
    void excludesNoticesOutsidePopupWindow() {
        JPAQueryFactory queries = mock(JPAQueryFactory.class);
        JPAQuery<Tuple> popupQuery = mock(JPAQuery.class, RETURNS_SELF);
        when(queries.select(org.mockito.ArgumentMatchers.<Expression<Tuple>>any()))
                .thenReturn(popupQuery);

        Instant now = Instant.parse("2026-09-15T12:00:00Z");
        NoticeFeedService feed = new NoticeFeedService(
                queries,
                mock(ConfigLookup.class),
                Clock.fixed(now, ZoneOffset.UTC));

        assertThat(feed.findPopup()).isEqualTo(NoticePopup.none());

        ArgumentCaptor<Predicate> predicate = ArgumentCaptor.forClass(Predicate.class);
        verify(popupQuery).where(predicate.capture());
        assertThat(predicate.getValue().toString())
                .contains("popupYn = true", "popupFromDtm <= " + now, "popupToDtm >= " + now);
    }

    @Test
    @DisplayName("제목이 비면 저장 전에 거부한다 — 화면 밖 호출도 공지의 이름을 만들지 못한다")
    void rejectsBlankTitleWithoutWriting() {
        assertRejected(new NoticeSaveRow(
                RowState.C, null, " ", "본문", Instant.parse("2026-09-15T00:00:00Z"), null,
                false, null, null, true, 0), NoticeErrorCode.REQUIRED);
    }

    @Test
    @DisplayName("팝업을 켰는데 기간이 비면 거부한다 — 언제 뜨는지 없는 전사 팝업은 만들지 않는다")
    void rejectsPopupWithoutWindow() {
        assertRejected(new NoticeSaveRow(
                RowState.C, null, "점검", "본문", Instant.parse("2026-09-15T00:00:00Z"), null,
                true, null, null, true, 0), NoticeErrorCode.POPUP_PERIOD_REQUIRED);
    }

    @Test
    @DisplayName("팝업 종료가 시작보다 이르면 거부한다 — 어느 순간에도 뜰 수 없는 범위다")
    void rejectsReversedPopupWindow() {
        assertRejected(new NoticeSaveRow(
                RowState.C, null, "점검", "본문", Instant.parse("2026-09-15T00:00:00Z"), null,
                true, Instant.parse("2026-09-15T11:00:00Z"), Instant.parse("2026-09-15T10:00:00Z"), true, 0),
                NoticeErrorCode.PERIOD_INVALID);
    }

    @Test
    @DisplayName("팝업 시작이 게시 시작보다 이르면 거부한다 — 목록에 없는 공지가 먼저 뜨지 않는다")
    void rejectsPopupStartingBeforeNotice() {
        assertRejected(new NoticeSaveRow(
                RowState.C, null, "점검", "본문", Instant.parse("2026-09-15T10:00:00Z"), null,
                true, Instant.parse("2026-09-15T09:59:59Z"), Instant.parse("2026-09-15T11:00:00Z"), true, 0),
                NoticeErrorCode.POPUP_RANGE);
    }

    @Test
    @DisplayName("팝업 종료가 게시 종료보다 늦으면 거부한다 — 종료 공지가 팝업으로 남지 않는다")
    void rejectsPopupEndingAfterNotice() {
        assertRejected(new NoticeSaveRow(
                RowState.C, null, "점검", "본문", Instant.parse("2026-09-15T10:00:00Z"), Instant.parse("2026-09-15T12:00:00Z"),
                true, Instant.parse("2026-09-15T10:30:00Z"), Instant.parse("2026-09-15T12:00:01Z"), true, 0),
                NoticeErrorCode.POPUP_RANGE);
    }

    @Test
    @DisplayName("팝업이 꺼진 공지는 남은 팝업 기간을 무시하고 저장한다 — 게시 기간만 고칠 수 있다")
    void savesNoticeWhenDisabledPopupKeepsOldWindow() {
        service.save(List.of(new NoticeSaveRow(
                RowState.C, null, "점검", "본문", Instant.parse("2026-09-15T10:00:00Z"), null,
                false, Instant.parse("2026-09-14T10:00:00Z"), Instant.parse("2026-09-14T11:00:00Z"), true, 0)));

        verify(notices).save(any());
    }

    private void assertRejected(NoticeSaveRow row, NoticeErrorCode expected) {
        assertThatThrownBy(() -> service.save(List.of(row)))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).errorCode())
                .isEqualTo(expected);
        verify(notices, never()).save(any());
    }
}
