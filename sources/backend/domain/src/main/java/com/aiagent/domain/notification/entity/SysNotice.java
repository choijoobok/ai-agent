package com.aiagent.domain.notification.entity;

import com.aiagent.core.domain.BaseAuditEntity;
import com.aiagent.core.domain.YnConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.TableGenerator;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.Nationalized;
import org.hibernate.type.SqlTypes;

/**
 * 공지사항 — 47 §9 · 66 §4.
 *
 * <h2>축이 셋이고 한 컬럼으로 합칠 수 없다</h2>
 *
 * <table><caption></caption>
 *   <tr><td><b>게시 기간</b></td><td>{@code NOTICE_FROM_DTM} · {@code NOTICE_TO_DTM}</td>
 *       <td><i>언제부터 언제까지 목록에 있는가</i> — 미리 정한다</td></tr>
 *   <tr><td><b>즉시 내림</b></td><td>{@code USE_YN}</td>
 *       <td><i>지금 당장 감출 것인가</i> — 사고 대응이다</td></tr>
 *   <tr><td><b>팝업 기간</b></td><td>{@code POPUP_*}</td>
 *       <td><i>그중 언제 팝업으로 띄우는가</i></td></tr>
 * </table>
 *
 * <p>게시 기간은 47 §9.2 가 신설했다 — 그 전에는 팝업 기간만 있어 <b>목록에 언제까지
 * 있는가를 말할 수 없었고</b>, 목업의 {@code 게시중}/{@code 종료} 배지가 근거 없이 떠
 * 있었다. {@code USE_YN} 만으로 닫으면 <b>내리는 것을 잊는 것이 정상 경로</b>가 되어
 * 점검 안내가 점검이 끝난 뒤에도 떠 있는다.
 *
 * <h2>대상도 읽음도 없다</h2>
 *
 * <p>공지는 <b>전체 공개</b>이며(66 §2.1) 역할별로 갈리는 통지는 공지가 아니라 알림이다 —
 * {@link SysNotiInbox} 가 {@code USER_ID} 를 갖는 것이 그 자리다. 읽음 상태도 두지
 * 않는다(66 §2.2): 배지가 공지를 세지 않으므로(main-shell.md §7.1) 저장해도 나타날 곳이 없고,
 * 전체 공개라 읽음은 <b>사용자 수 × 공지 수</b>로 자라는 교차 테이블이 된다.
 *
 * <h2>감사 4컬럼이 있다 — 사람이 작성한다</h2>
 *
 * <p>{@link BaseAuditEntity} 를 상속하는 것이 {@link SysNotiInbox} 와 갈리는 지점이다.
 * 저쪽은 시스템이 넣고 여기는 사람이 쓴다(47 §9).
 */
@Entity
@Table(name = "SYS_NOTICE")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysNotice extends BaseAuditEntity {

    public static final int TITLE_MAX = 500;

    /**
     * {@code CONTENT_TYPE_CD} 의 기본 — 47 §9.
     *
     * <p><b>지금 값이 이것 하나뿐이라 화면이 컬럼을 감춘다</b>(66 §4.3). 컬럼을 빼지 않는
     * 것은 에디터를 붙이는 프로젝트가 {@code HTML} 로 저장하기 때문이며, 그때
     * <b>저장 시 sanitize 가 필수</b>다 — 공지는 전 사용자에게 렌더링된다.
     */
    public static final String CONTENT_TYPE_TEXT = "TEXT";

    @Id
    @GeneratedValue(strategy = GenerationType.TABLE, generator = "sys_sequence")
    @TableGenerator(
            name = "sys_sequence",
            table = "SYS_SEQUENCE",
            pkColumnName = "SEQ_NAME",
            valueColumnName = "NEXT_VAL",
            pkColumnValue = "SYS_NOTICE",
            initialValue = 1,
            allocationSize = 50)
    @Column(name = "NOTICE_ID")
    private Long noticeId;

    @Column(name = "TITLE", length = TITLE_MAX, nullable = false)
    private String title;

    /**
     * 본문 — {@code nclob} 이다.
     *
     * <p>{@code @Lob} 이 아니라 이 조합인 것은 db-portability.md §3.1 의 실측 때문이다 — {@code @Lob} 은
     * MySQL 에서 {@code tinytext}(255바이트)가 되어 본문이 들어가지 않는다.
     *
     * <p>화면은 <b>셀에서 한 줄로 자르고 {@code textModal} 로 연다</b>(grid-column-contract.md §5.5 · 66 §4.3).
     * <b>정렬은 끈다</b> — Oracle 이 {@code CLOB} 의 {@code ORDER BY} 를 막는다.
     */
    @Nationalized
    @JdbcTypeCode(SqlTypes.LONG32NVARCHAR)
    @Column(name = "CONTENT", nullable = false)
    private String content;

    @Column(name = "CONTENT_TYPE_CD", length = 20, nullable = false)
    private String contentTypeCd;

    /**
     * 게시 시작 — <b>필수다</b>(47 §9.2).
     *
     * <p>비울 수 있게 두면 <i>지금부터</i> 와 <i>정하지 않음</i> 이 같은 값이 되어 자동
     * 노출을 판정할 수 없다. 필수이므로 <b>예약 게시가 성립한다</b>.
     */
    @Column(name = "NOTICE_FROM_DTM", nullable = false)
    private Instant noticeFromDtm;

    /** 게시 종료 — <b>비우면 무기한</b>이다(47 §9.2). */
    @Column(name = "NOTICE_TO_DTM")
    private Instant noticeToDtm;

    @Convert(converter = YnConverter.class)
    @Column(name = "POPUP_YN", length = 1, nullable = false)
    private Boolean popupYn;

    /**
     * 팝업 기간 — <b>게시 기간 안이어야 한다</b>(66 §4.5).
     *
     * <p>넘으면 <i>팝업은 뜨는데 목록에 없는 공지</i>가 생기고, 팝업의
     * <i>"공지 N건 더 있음"</i> 링크가 빈 목록으로 간다. 검증은 서비스가 하며 DB 제약으로
     * 걸지 않는 것은 {@code CHECK} 문법이 벤더마다 갈리기 때문이다(22).
     */
    @Column(name = "POPUP_FROM_DTM")
    private Instant popupFromDtm;

    @Column(name = "POPUP_TO_DTM")
    private Instant popupToDtm;

    /**
     * 즉시 내림 — <b>기간과 축이 다르다</b>(47 §9.2).
     *
     * <p>표시 판정에서 이것이 기간을 이긴다: {@code false} 면 기간 안이어도 목록에서
     * 사라진다(66 §4.4). 기간을 고쳐 내리게 하면 <b>미래의 게시 계획을 손으로 지우는
     * 일</b>이 되고, 되돌릴 때 원래 기간을 기억해야 한다.
     */
    @Convert(converter = YnConverter.class)
    @Column(name = "USE_YN", length = 1, nullable = false)
    private Boolean useYn;

    /**
     * 목록 상단 고정 — 66 §4.2.1. <b>드래그가 아니라 숫자다</b>(65 §3.3 과 같은 판단).
     *
     * <p>중복을 막지 않는다. 결정성은 tie-breaker({@code NOTICE_ID})가 주며, 그 결정성이
     * <b>화면에 직접 보인다</b> — 팝업이 이 정렬의 첫 건을 집는다(66 §2.4 C안).
     */
    @Column(name = "SORT_NO", nullable = false)
    private Integer sortNo;

    /** 신규 — {@code NOTICE_ID} 는 채번이므로 여기서 정하지 않는다. */
    public static SysNotice created(
            String title,
            String content,
            Instant noticeFromDtm,
            Instant noticeToDtm,
            boolean popupYn,
            Instant popupFromDtm,
            Instant popupToDtm,
            boolean useYn,
            int sortNo) {
        SysNotice notice = new SysNotice();
        notice.contentTypeCd = CONTENT_TYPE_TEXT;
        notice.apply(
                title, content, noticeFromDtm, noticeToDtm,
                popupYn, popupFromDtm, popupToDtm, useYn, sortNo);
        return notice;
    }

    /**
     * 수정 — <b>전 컬럼을 함께 쓴다</b>(grid-standard.md §3.1). 그리드 한 행이 한 번에 저장된다.
     *
     * <p><b>{@code POPUP_YN} 을 꺼도 팝업 기간을 지우지 않는다</b>(66 §4.5) — 다시 켤 때
     * 값이 살아 있어야 한다. 화면이 보내 준 값을 그대로 쓴다.
     *
     * <p>{@code CONTENT_TYPE_CD} 를 받지 않는다. 값이 {@code TEXT} 하나뿐이라 고를 것이
     * 없고(66 §4.3), 받을 경로를 두면 <b>화면이 렌더 방식을 정하는</b> 셈이 된다 —
     * {@code HTML} 이 들어오면 표시 측이 분기하지 않아 태그가 글자로 보인다.
     */
    public void apply(
            String title,
            String content,
            Instant noticeFromDtm,
            Instant noticeToDtm,
            boolean popupYn,
            Instant popupFromDtm,
            Instant popupToDtm,
            boolean useYn,
            int sortNo) {
        this.title = title;
        this.content = content;
        this.noticeFromDtm = noticeFromDtm;
        this.noticeToDtm = noticeToDtm;
        this.popupYn = popupYn;
        this.popupFromDtm = popupFromDtm;
        this.popupToDtm = popupToDtm;
        this.useYn = useYn;
        this.sortNo = sortNo;
    }
}
