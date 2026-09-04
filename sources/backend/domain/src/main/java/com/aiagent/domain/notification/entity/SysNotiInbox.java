package com.aiagent.domain.notification.entity;

import com.aiagent.core.domain.YnConverter;
import com.aiagent.domain.notification.NotiType;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.TableGenerator;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 인앱 알림함 — 47 §7 · main-shell.md §7 · 66 §6.
 *
 * <h2>큐가 아니다</h2>
 *
 * <p>47 §5.1 이 <i>"인앱 알림은 outbox 를 거치지 않는다 — DB 에 행을 쓰는 것이 곧 도달"</i>
 * 로 갈라 두었다. 그래서 상태 전이도 릴레이도 없고 {@code READ_YN} 하나만 바뀐다.
 * {@code SYS_NOTI_OUTBOX} 는 <b>테이블 자체가 없다</b>(66 §6.1) — 외부 채널 어댑터가 없는
 * 배포에서 outbox 는 지나가는 것이 없는 테이블이라 DDL 을 미뤘다.
 *
 * <h2>지금 이 엔티티가 있는 이유는 파기 배치다</h2>
 *
 * <p>보존이 90일이고(32 §3 · 47 §10) {@code RetentionPurgeJob} 이 리포지토리로 도는 구조라
 * 대상 테이블에는 엔티티가 있어야 한다. <b>읽기·쓰기 서비스는 아직 없다</b> — 알림 모달과
 * 생산자 넷(66 §6.2)이 오는 슬라이스의 것이다.
 *
 * <h2>감사 4컬럼이 없다</h2>
 *
 * <p>행을 만드는 것은 사람이 아니라 시스템이고 {@code USER_ID} 는 작성자가 아니라
 * <b>수신자</b>다 — {@code REG_ID} 를 두면 언제나 {@code 'system'} 인 컬럼이 하나 는다
 * (40 §4.2 가 <i>신뢰할 수 없는 컬럼</i> 이라 부른 것). <i>누가 넣었는가</i> 는
 * {@link #notiTypeCd} 가 답하며 그것이 곧 생산자의 종류다.
 *
 * <p>{@code allocationSize} 가 <b>50</b> 이다 — 이력 3종과 배치 이력이 1000 인 것과 갈린다
 * (45 §3 · ADR-0015). 저쪽은 <b>요청마다</b> 나지만 알림은 <b>사건마다</b> 난다. 만료 예고
 * 배치가 한 번에 수백 건을 넣는 버스트가 있고 그때 {@code SYS_SEQUENCE} 왕복이 늘지만,
 * 그 버스트는 하루 한 번이다. 아프면 올리면 된다 — 설정 한 줄이다(ADR-0015).
 */
@Entity
@Table(name = "SYS_NOTI_INBOX")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysNotiInbox {

    public static final int TITLE_MAX = 500;

    /**
     * {@code CONTENT} — {@code nclob} 이 아니다(47 §7 — <i>"길지 않다. 상세는 링크로
     * 보낸다"</i>).
     *
     * <p>알림은 읽고 닫는 것이지 문서가 아니며, <b>목록에 그대로 실려야 하므로</b>
     * {@code nclob} 의 미적재 규약(grid-column-contract.md §5.5)에 걸리면 안 된다. {@code VARCHAR} 이므로
     * 초과분은 절단이다.
     */
    public static final int CONTENT_MAX = 2000;

    public static final int LINK_PARAM_MAX = 500;

    @Id
    @GeneratedValue(strategy = GenerationType.TABLE, generator = "sys_sequence")
    @TableGenerator(
            name = "sys_sequence",
            table = "SYS_SEQUENCE",
            pkColumnName = "SEQ_NAME",
            valueColumnName = "NEXT_VAL",
            pkColumnValue = "SYS_NOTI_INBOX",
            initialValue = 1,
            allocationSize = 50)
    @Column(name = "NOTI_ID")
    private Long notiId;

    /**
     * <b>수신자</b>다 — 작성자가 아니다. FK 가 걸려 있다(47 §7).
     *
     * <p>{@code SYS_USER} 는 물리 삭제를 하지 않으므로(USER-02 · 41 §4.5) 이 FK 가 계정
     * 정리를 막지 않는다 — {@code SYS_BATCH_HISTORY} 가 {@code BATCH_ID} 에 FK 를 걸지 못한
     * 것과 갈리는 자리다(46 §2.2 · 66 §5.7.1).
     */
    @Column(name = "USER_ID", length = 30, nullable = false)
    private String userId;

    /**
     * {@code AUTH} · {@code AUTHZ} · {@code BATCH} · {@code REQUEST} — 66 §6.2 의 생산자
     * 넷과 1:1 이다.
     *
     * <p><b>공통코드가 아니다</b>(47 §10 · 66 §3.2). 값은 소스가 분기하는 것이라 관리자가
     * 늘리면 <b>처리 코드가 없는 값</b>이 생긴다. 라벨만 메시지 키({@code noti.type.*})다.
     *
     * <p>{@code String} 이 아니라 열거형인 것은 <b>넣는 쪽이 넷 중에서 고르게</b> 하기
     * 위해서다 — {@code SysBatchHistory.rsltCd} 와 같은 매핑이며(<b>{@code @Enumerated
     * (STRING)}</b> 이라 컬럼은 그대로 {@code VARCHAR}), 생산자가 넷으로 정해져 있는
     * 값에 오타가 들어갈 경로를 닫는다.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "NOTI_TYPE_CD", length = 30, nullable = false)
    private NotiType notiTypeCd;

    @Column(name = "TITLE", length = TITLE_MAX, nullable = false)
    private String title;

    @Column(name = "CONTENT", length = CONTENT_MAX)
    private String content;

    /**
     * 클릭 시 열 메뉴 — <b>URL 이 아니라 메뉴 코드</b>다(47 §7).
     *
     * <p>URL 을 담으면 메뉴 경로가 바뀔 때 <b>과거 알림이 전부 깨진다</b>. 메뉴 코드는 PK 라
     * 바뀌지 않으며 권한 게이트도 그대로 적용된다 — 권한이 없어진 메뉴로 가는 알림은
     * 이동 버튼이 비활성이다.
     *
     * <p><b>FK 가 없다.</b> 알림은 이력이라 대상 메뉴가 사라져도 남아야 하는데, FK 가 있으면
     * 메뉴 하나를 지우려고 과거 알림을 먼저 지워야 한다. 이 엔티티에서 <b>끊어질 수 있는
     * 유일한 참조</b>이며 표시 시점에 이동 버튼을 감추는 것으로 처리한다(66 §5.7.1).
     *
     * <p>{@code null} 이면 이동 없음이다 — 요청 처리 알림이 그렇다(66 §5.4): 결과를 보러 갈
     * 자리가 알림 모달의 탭이고 <b>탭에는 {@code MENU_CD} 가 없다</b>(60 §1.1).
     */
    @Column(name = "LINK_MENU_CD", length = 30)
    private String linkMenuCd;

    @Column(name = "LINK_PARAM", length = LINK_PARAM_MAX)
    private String linkParam;

    /**
     * <b>미읽음 배지가 세는 유일한 값</b>이다(main-shell.md §7.1) — 공지와 요청은 세지 않는다.
     *
     * <p>목록을 열었다고 전체를 {@code true} 로 바꾸지 않는다(main-shell.md §7.2) — 훑어만 봐도 배지가
     * 사라지면 <b>놓친 알림을 찾을 수 없다</b>. 항목을 연 것과 <i>"모두 읽음"</i> 버튼만 바꾼다.
     */
    @Convert(converter = YnConverter.class)
    @Column(name = "READ_YN", length = 1, nullable = false)
    private Boolean readYn;

    @Column(name = "READ_DTM")
    private Instant readDtm;

    /** 발생 시각. 목록의 기본 정렬이자 <b>파기 배치의 기준</b>이다 — 90일(32 §3). */
    @Column(name = "CRE_DTM", nullable = false)
    private Instant creDtm;

    @Builder
    private SysNotiInbox(
            String userId,
            NotiType notiTypeCd,
            String title,
            String content,
            String linkMenuCd,
            String linkParam,
            Instant creDtm) {
        this.userId = userId;
        this.notiTypeCd = notiTypeCd;
        this.title = truncate(title, TITLE_MAX);
        this.content = truncate(content, CONTENT_MAX);
        this.linkMenuCd = linkMenuCd;
        this.linkParam = truncate(linkParam, LINK_PARAM_MAX);
        this.readYn = false;
        this.creDtm = creDtm;
    }

    /**
     * 이 항목을 읽었다 — <b>한 번만 유효하다</b>.
     *
     * <p>이미 읽은 것을 다시 열어도 {@code READ_DTM} 을 갱신하지 않는다: 그 값이 답하는
     * 물음은 <i>"언제 처음 봤나"</i> 이고, 갱신하면 <i>"마지막으로 열어 본 때"</i> 가 되어
     * 둘 다 잃는다.
     */
    public void markRead(Instant at) {
        if (Boolean.TRUE.equals(this.readYn)) {
            return;
        }
        this.readYn = true;
        this.readDtm = at;
    }

    private static String truncate(String value, int max) {
        if (value == null || value.length() <= max) {
            return value;
        }
        return value.substring(0, max);
    }
}
