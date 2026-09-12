package com.aiagent.domain.notification.notice;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.RowTx;
import com.aiagent.core.grid.RowState;
import com.aiagent.domain.notification.entity.SysNotice;
import com.aiagent.domain.notification.repository.SysNoticeRepository;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code NOTICE_MGMT} 의 저장 — screen/admin/system/notice/requirements.md.
 *
 * <h2>여기서 만든 것이 전 사용자에게 뜬다</h2>
 *
 * <p>62~65 의 관리 화면은 잘못 고치면 <b>관리자가</b> 곤란하다. 이 화면에서 잘못 올린
 * 글은 <b>다음 로그인부터 전원에게 팝업으로</b> 뜨며, 그것이 검증 넷 중 셋째가 있는
 * 이유다(screen/admin/system/notice/requirements.md).
 *
 * <h2>검증 넷 — 셋째가 이 화면 고유의 것이다</h2>
 *
 * <table><caption></caption>
 * <tr><td>제목·본문·게시 시작 필수</td><td>화면도 한다 — 여기는 마지막 방어다(backend/security.md)</td></tr>
 *   <tr><td>게시 종료 &ge; 시작</td><td>〃</td></tr>
 *   <tr><td><b>팝업 기간 &sube; 게시 기간</b></td>
 *       <td><b>표시 측 계약</b>이다 — 넘으면 팝업의 <i>"N건 더 있음"</i> 링크가 빈 목록으로 간다</td></tr>
 *   <tr><td>팝업을 켜면 팝업 기간 필수</td><td>화면도 한다</td></tr>
 * </table>
 *
 * <h2>삭제는 물리 삭제다</h2>
 *
 * <p>{@code USE_YN='N'} 이 이미 <i>내림</i> 이므로 지우는 것은 <b>잘못 만든 것</b>에만
 * 쓴다(screen/admin/system/notice/requirements.md). 논리 삭제 플래그를 하나 더 두면 <i>내림</i> 과 <i>지움</i> 이 화면에서
 * 구분되지 않는다.
 *
 * <p><b>게이트가 없다.</b> {@code BATCH_SCHEDULE} 은 <i>켜져 있는가·도는가</i> 를 봤지만
 * (screen/admin/system/batch/schedule/requirements.md) 공지는 지운다고 조용히 멈추는 것이 없다 — 지워진 뒤에 아무도 그것을 참조하지
 * 않는다. 첨부가 붙는 날 {@code SYS_FILE_REF} 를 함께 지우는 조항이 는다(screen/admin/system/notice/requirements.md).
 */
@Service
public class NoticeService {

    private final SysNoticeRepository notices;
    private final NoticeQueryService queries;

    public NoticeService(SysNoticeRepository notices, NoticeQueryService queries) {
        this.notices = notices;
        this.queries = queries;
    }

    /**
     * 일괄 저장 — frontend/grid.md. <b>한 트랜잭션이다</b>(UX-14).
     *
     * <p><b>전건을 먼저 검증하고 그다음에 쓴다</b>({@code BatchScheduleService} 와 같은
     * 순서). 섞으면 거부되는 요청이 쓰기를 한 번 내고 돌아가며, 롤백해도 <b>SQL 로그에는
     * 남고 시퀀스는 뛴다</b> — 이 테이블은 채번을 쓰므로 후자가 실제로 일어난다.
     */
    @Transactional
    public void save(List<NoticeSaveRow> rows) {
        /*
          같은 요청 안의 중복 대상. 화면은 막지만 막혔다고 서버가 안 봐도 되는 것은
          아니다 — 같은 NOTICE_ID 를 U 와 D 로 함께 보내면 순서에 따라 결과가 갈린다.
          신규(C)는 채번이라 noticeId 가 null 이므로 이 검사에서 제외된다.
        */
        Set<Long> seen = new HashSet<>();
        RowTx.oneTxForAll(rows, row -> {
            if (row.noticeId() != null && !seen.add(row.noticeId())) {
                throw new BusinessException(
                        NoticeErrorCode.NOT_FOUND,
                        "같은 공지가 두 번 왔다 — " + row.noticeId(),
                        List.of(new BusinessException.FieldError(
                                "title", "같은 공지가 두 번 왔습니다", String.valueOf(row.noticeId()))));
            }
            if (row.rowState() != RowState.D) {
                validate(row);
            }
        });

        RowTx.oneTxForAll(rows, row -> {
            switch (row.rowState()) {
                case C -> create(row);
                case U -> update(row);
                case D -> notices.delete(queries.require(row.noticeId()));
            }
        });
    }

    private void create(NoticeSaveRow row) {
        notices.save(SysNotice.created(
                row.title(),
                row.content(),
                row.noticeFromDtm(),
                row.noticeToDtm(),
                row.popupYnOrFalse(),
                row.popupFromDtm(),
                row.popupToDtm(),
                row.useYnOrTrue(),
                row.sortNoOrZero()));
    }

    private void update(NoticeSaveRow row) {
        queries.require(row.noticeId())
                .apply(
                        row.title(),
                        row.content(),
                        row.noticeFromDtm(),
                        row.noticeToDtm(),
                        row.popupYnOrFalse(),
                        row.popupFromDtm(),
                        row.popupToDtm(),
                        row.useYnOrTrue(),
                        row.sortNoOrZero());
    }

    // ── 검증 (screen/admin/system/notice/requirements.md) ──────────────────────────────────────────────

    private void validate(NoticeSaveRow row) {
        requireText(row.title(), "title", "제목은 필수입니다");
        requireText(row.content(), "content", "본문은 필수입니다");
        if (row.noticeFromDtm() == null) {
            throw required("noticeFromDtm", "게시 시작은 필수입니다");
        }

        Instant from = row.noticeFromDtm();
        Instant to = row.noticeToDtm();
        if (to != null && to.isBefore(from)) {
            throw new BusinessException(
                    NoticeErrorCode.PERIOD_INVALID,
                    "게시 종료가 시작보다 앞이다 — " + from + " ~ " + to,
                    List.of(new BusinessException.FieldError(
                            "noticeToDtm", "게시 종료는 시작보다 뒤여야 합니다")));
        }

        if (!row.popupYnOrFalse()) {
            /*
              **꺼져 있으면 팝업 기간을 보지 않는다.** 값이 남아 있는 것이 의도이고
              (screen/admin/system/notice/requirements.md — 다시 켤 때 살아 있어야 한다), 남은 값이 게시 기간과 어긋난다는
              이유로 저장을 막으면 **게시 기간만 고치려던 사람이 팝업 칸에서 막힌다.**
              다시 켜는 순간 아래 검증이 그것을 잡는다.
            */
            return;
        }
        if (row.popupFromDtm() == null || row.popupToDtm() == null) {
            throw new BusinessException(
                    NoticeErrorCode.POPUP_PERIOD_REQUIRED,
                    "팝업을 켰는데 기간이 비었다",
                    List.of(new BusinessException.FieldError(
                            "popupFromDtm", "팝업 기간을 입력하세요")));
        }
        if (row.popupToDtm().isBefore(row.popupFromDtm())) {
            throw new BusinessException(
                    NoticeErrorCode.PERIOD_INVALID,
                    "팝업 종료가 시작보다 앞이다",
                    List.of(new BusinessException.FieldError(
                            "popupToDtm", "팝업 종료는 시작보다 뒤여야 합니다")));
        }
        requirePopupWithin(row, from, to);
    }

    /**
     * <b>팝업 기간 &sube; 게시 기간</b> — screen/admin/system/notice/requirements.md. 이 화면 고유의 검증이다.
     *
     * <p>없으면 <b>목록에 없는 공지가 팝업으로 뜬다</b>. 팝업은 C안이라 최신 1건만 띄우고
     * 나머지를 <i>"공지 N건 더 있음 →"</i> 로 알림 모달의 공지 탭에 넘기는데(screen/admin/system/notice/requirements.md),
     * 그 탭의 조회는 <b>게시 기간</b>을 본다(screen/admin/system/notice/requirements.md) — 팝업만 뜨고 목록에 없으면 눌러도
     * 그 공지가 없다.
     *
     * <p><b>어느 쪽을 고쳐야 하는지 말한다.</b> 관련된 칸이 넷이라 <i>"기간이 올바르지
     * 않습니다"</i> 로 끝내면 사용자가 찾아야 한다.
     */
    private static void requirePopupWithin(NoticeSaveRow row, Instant from, Instant to) {
        if (row.popupFromDtm().isBefore(from)) {
            throw new BusinessException(
                    NoticeErrorCode.POPUP_RANGE,
                    "팝업 시작이 게시 시작보다 앞이다 — " + row.popupFromDtm() + " < " + from,
                    List.of(new BusinessException.FieldError(
                            "popupFromDtm", "팝업 시작은 게시 시작보다 앞일 수 없습니다")));
        }
        if (to != null && row.popupToDtm().isAfter(to)) {
            throw new BusinessException(
                    NoticeErrorCode.POPUP_RANGE,
                    "팝업 종료가 게시 종료보다 뒤다 — " + row.popupToDtm() + " > " + to,
                    List.of(new BusinessException.FieldError(
                            "popupToDtm", "팝업 종료는 게시 종료보다 뒤일 수 없습니다")));
        }
        /*
          **게시 종료가 없으면(무기한) 팝업 종료는 무엇이든 된다.** 무기한 게시 안에는
          어떤 유한 구간도 들어간다 — 조건을 빠뜨린 것이 아니라 성립하는 것이 없다.
        */
    }

    private static void requireText(String value, String field, String message) {
        if (value == null || value.isBlank()) {
            throw required(field, message);
        }
    }

    private static BusinessException required(String field, String message) {
        return new BusinessException(
                NoticeErrorCode.REQUIRED,
                "필수 값이 비었다 — " + field,
                List.of(new BusinessException.FieldError(field, message)));
    }
}
