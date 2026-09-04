package com.aiagent.domain.notification.entity;

import com.aiagent.domain.notification.ReqStatus;
import com.aiagent.domain.notification.ReqType;
import jakarta.persistence.Column;
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
 * 사용자 → 관리자 요청함 — 47 §8 · 66 §5.
 *
 * <p>{@link SysNotiInbox} 와 <b>방향이 반대이고 상태의 성격이 다르다</b>(47 §5) — 알림은
 * 읽음(봤나), 요청은 처리(했나)다. 한 테이블에 합치면 그 둘이 한 컬럼에 섞인다.
 *
 * <h2>감사 4컬럼이 없다 — 짝이 둘 있고 뜻이 다르다</h2>
 *
 * <p>{@code REG_*} 자리는 {@code USER_ID} + {@code CRE_DTM} 이고 {@code MOD_*} 자리는
 * {@link #handlerId} + {@link #handleDtm} 이다. 같은 사실을 두 벌로 적지 않는다(40 §4.2).
 * <b>두 짝의 뜻이 다른 것이 요점</b>이다 — 앞은 낸 사람, 뒤는 <b>판정한</b> 사람이다.
 *
 * <h2>화면이 셀을 고치지 않는다</h2>
 *
 * <p>66 §5.2 — 처리는 저장이 아니라 <b>판정</b>이고, 부수 효과가 있으며(요청자에게 알림이
 * 나간다), 반려는 두 값을 함께 강제해야 한다. 그래서 이 엔티티에는 그리드 저장이 부르는
 * {@code apply(전 컬럼)} 이 없고 {@link #handle} 하나만 있다.
 */
@Entity
@Table(name = "SYS_NOTI_REQUEST")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysNotiRequest {

    /**
     * {@code REQ_CONTENT} — {@code nclob} 이 아니다(47 §8).
     *
     * <p>목록에 실리는 컬럼이라 {@code nclob} 미적재 규약(grid-column-contract.md §5.5)에 걸리면 안 된다.
     * 그럼에도 셀 한 줄에는 안 들어가므로 화면은 {@code textModal} 을 <b>읽기 모드</b>로
     * 연다 — <i>길이가 타입과 무관하다</i>는 그 절의 주장이 반대 방향에서 확인되는 자리다.
     */
    public static final int REQ_CONTENT_MAX = 2000;

    public static final int HANDLE_MEMO_MAX = 2000;

    @Id
    @GeneratedValue(strategy = GenerationType.TABLE, generator = "sys_sequence")
    @TableGenerator(
            name = "sys_sequence",
            table = "SYS_SEQUENCE",
            pkColumnName = "SEQ_NAME",
            valueColumnName = "NEXT_VAL",
            pkColumnValue = "SYS_NOTI_REQUEST",
            initialValue = 1,
            allocationSize = 50)
    @Column(name = "REQ_ID")
    private Long reqId;

    /** 요청자. FK 가 걸려 있다(47 §8) — {@link SysNotiInbox#getUserId()} 와 같은 근거다. */
    @Column(name = "USER_ID", length = 30, nullable = false)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "REQ_TYPE_CD", length = 30, nullable = false)
    private ReqType reqTypeCd;

    @Column(name = "REQ_CONTENT", length = REQ_CONTENT_MAX, nullable = false)
    private String reqContent;

    @Enumerated(EnumType.STRING)
    @Column(name = "REQ_STAT_CD", length = 20, nullable = false)
    private ReqStatus reqStatCd;

    /**
     * 처리한 관리자 — FK 가 없다(47 §8).
     *
     * <p>{@code NULL} 이 정상 상태(미처리)라 제약이 지키는 것이 요청자 쪽보다 적다.
     * 길이는 {@code SYS_USER.USER_ID} 와 같아야 조인이 성립한다.
     */
    @Column(name = "HANDLER_ID", length = 30)
    private String handlerId;

    @Column(name = "HANDLE_DTM")
    private Instant handleDtm;

    /**
     * 처리·반려 사유 — <b>반려에서만 필수</b>다(47 §8.1 · 66 §5.3).
     *
     * <p>비대칭이 의도다. 처리는 결과 자체가 답이지만 반려는 이유가 없으면 답이 아니며,
     * 사유 없는 반려는 요청자가 <b>같은 요청을 다시 내게</b> 만든다 — 그것이 워크플로를
     * 만들지 않기로 한 대가(01 §2)를 실제 비용으로 바꾼다.
     */
    @Column(name = "HANDLE_MEMO", length = HANDLE_MEMO_MAX)
    private String handleMemo;

    @Column(name = "CRE_DTM", nullable = false)
    private Instant creDtm;

    @Builder
    private SysNotiRequest(String userId, ReqType reqTypeCd, String reqContent, Instant creDtm) {
        this.userId = userId;
        this.reqTypeCd = reqTypeCd;
        this.reqContent = truncate(reqContent, REQ_CONTENT_MAX);
        this.reqStatCd = ReqStatus.RECEIVED;
        this.creDtm = creDtm;
    }

    /**
     * 처리하거나 반려한다 — <b>{@link ReqStatus#RECEIVED} 에서만 유효</b>하다.
     *
     * <p>이미 처리된 것을 다시 처리하면 <b>요청자에게 알림이 두 번</b> 간다. 그래서
     * 상태 검사를 서비스가 아니라 <b>여기</b>에 둔다 — 부르는 경로가 늘어도 규칙이
     * 따라온다({@code false} 를 돌려주고 서비스가 그것을 사용자 문구로 옮긴다).
     *
     * @return 상태가 실제로 바뀌었으면 {@code true}
     */
    public boolean handle(ReqStatus to, String handlerId, String memo, Instant at) {
        if (this.reqStatCd != ReqStatus.RECEIVED) {
            return false;
        }
        this.reqStatCd = to;
        this.handlerId = handlerId;
        this.handleMemo = truncate(memo, HANDLE_MEMO_MAX);
        this.handleDtm = at;
        return true;
    }

    private static String truncate(String value, int max) {
        if (value == null || value.length() <= max) {
            return value;
        }
        return value.substring(0, max);
    }
}
