// @feat FEAT-509
package com.aiagent.domain.notification.request;

import com.aiagent.core.error.BusinessException;
import com.aiagent.domain.notification.NotiType;
import com.aiagent.domain.notification.NotificationSender;
import com.aiagent.domain.notification.ReqStatus;
import com.aiagent.domain.notification.entity.SysNotiRequest;
import com.aiagent.domain.notification.repository.SysNotiRequestRepository;
import java.time.Clock;
import java.util.List;
import org.springframework.data.domain.AuditorAware;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code NOTI_REQUEST} 의 처리 — screen/admin/system/noti-request/requirements.md.
 *
 * <h2>이 서비스가 {@code SYS_NOTI_INBOX} 의 첫 생산자다</h2>
 *
 * <p>frontend/tabs.md 이 요청 탭에 배지를 두지 않으며 <i>"상태가 바뀌면 그것이 내 알림으로 온다"</i>
 * 고 적었다. <b>그 알림을 넣는 곳이 여기</b>이며, screen/admin/system/noti-request/requirements.md 의 생산자 넷 중 <b>이 슬라이스
 * 안에서 자급자족하는 유일한 것</b>이다 — 나머지 셋(비밀번호 만료 · 권한 만료 · 배치
 * 실패)은 각자의 기능이 서야 온다.
 *
 * <h2>같은 트랜잭션이다</h2>
 *
 * <p>{@link NotificationSender} 가 새 트랜잭션을 열지 않으므로 여기 참여한다 — 처리가
 * 롤백되면 알림도 없다. sys/notification.md 의 <i>"DB 에 행을 쓰는 것이 곧 도달"</i> 이 그 반대편도
 * 뜻한다: <b>커밋되지 않으면 도달하지 않는다</b>.
 *
 * <h2>섞이면 전부 막는다</h2>
 *
 * <p>선택에 이미 처리된 것이 하나라도 있으면 <b>아무것도 처리하지 않는다</b>(screen/admin/system/noti-request/requirements.md).
 * 처리 가능한 것만 골라 실행하면 <b>알림이 일부에게만 나가고</b> 사용자는 무엇이
 * 처리됐는지 모른다 — 되돌리는 길이 없으므로 부분 성공을 만들지 않는다.
 */
@Service
public class NotiRequestService {

    private final SysNotiRequestRepository requests;
    private final NotificationSender notifications;
    private final AuditorAware<String> auditor;
    private final Clock clock;

    public NotiRequestService(
            SysNotiRequestRepository requests,
            NotificationSender notifications,
            AuditorAware<String> auditor,
            Clock clock) {
        this.requests = requests;
        this.notifications = notifications;
        this.auditor = auditor;
        this.clock = clock;
    }

    /**
     * 처리 또는 반려 — <b>한 트랜잭션이다</b>.
     *
     * <p>{@code updateHandle} 하나가 둘을 다 하는 이유는 <b>쓰는 컬럼이 같고 트랜잭션이
     * 같기 때문</b>이다(screen/admin/system/noti-request/requirements.md). 둘로 가르면 알림 INSERT 코드가 두 벌이 되고 한쪽만
     * 고치는 날이 온다.
     *
     * <p><b>처리자는 인자가 아니라 {@code AuditorAware} 에서 온다</b>({@code DbLockStore} 와
     * 같은 방식). 인자로 받으면 <i>남의 이름으로 처리한 것</i>을 만들 경로가 열리고,
     * {@code HANDLER_ID} 가 답해야 하는 물음은 <b>누가 판정했나</b> 하나다.
     *
     * @param to {@link ReqStatus#DONE} 또는 {@link ReqStatus#REJECTED} 뿐이다 —
     * {@link ReqStatus#RECEIVED} 로 되돌리는 길은 없다(screen/admin/system/noti-request/requirements.md)
     */
    @Transactional
    public void handle(List<Long> reqIds, ReqStatus to, String memo) {
        if (to != ReqStatus.DONE && to != ReqStatus.REJECTED) {
            throw new BusinessException(
                    NotiRequestErrorCode.NOT_RECEIVED,
                    "되돌리는 전이는 없다 — " + to);
        }
        if (to == ReqStatus.REJECTED && (memo == null || memo.isBlank())) {
            throw new BusinessException(
                    NotiRequestErrorCode.MEMO_REQUIRED,
                    "반려인데 사유가 비었다",
                    List.of(new BusinessException.FieldError(
                            "handleMemo", "반려 사유를 입력하세요")));
        }

        List<Long> orderedReqIds = reqIds.stream().sorted().toList();
        List<SysNotiRequest> targets = requests.lockAllByReqIdIn(orderedReqIds);
        if (targets.size() != reqIds.size()) {
            throw new BusinessException(
                    NotiRequestErrorCode.NOT_FOUND,
                    "없는 요청이 섞였다 — 요청 " + reqIds.size() + "건 중 " + targets.size() + "건만 있다");
        }

        /*
          **전건을 먼저 보고 그다음에 쓴다.** 하나라도 RECEIVED 가 아니면 아무것도 하지
          않는다 — handle() 이 false 를 돌려주는 시점에 앞의 것들은 이미 바뀌어 있고,
          트랜잭션이 롤백해도 **알림은 같은 트랜잭션이라 함께 사라지지만** SQL 로그에는
          남는다. 그리고 사용자에게 "몇 건이 왜 안 됐나" 를 말하려면 먼저 세야 한다.
        */
        for (SysNotiRequest request : targets) {
            if (request.getReqStatCd() != ReqStatus.RECEIVED) {
                throw new BusinessException(
                        NotiRequestErrorCode.NOT_RECEIVED,
                        "이미 처리된 요청이 있다 — " + request.getReqId()
                                + " (" + request.getReqStatCd() + ")");
            }
        }

        String handlerId = auditor.getCurrentAuditor().orElse(null);
        var now = clock.instant();
        for (SysNotiRequest request : targets) {
            request.handle(to, handlerId, memo, now);
            notifications.send(
                    request.getUserId(),
                    NotiType.REQUEST,
                    titleOf(to),
                    contentOf(to, memo));
        }
    }

    /**
     * 알림 제목 — <b>메시지 키가 아니라 문장이다</b>.
     *
     * <p>sys/notification.md 이 알림 템플릿을 {@code SYS_MESSAGE} 로 정했지만 그것은 <b>다국어가 필요한
     * 발송 템플릿</b>의 이야기다(NOTI-04). 인앱 알림의 제목은 <b>수신 시점에 확정되어
     * 행에 저장</b>되므로(sys/notification.md 의 {@code TITLE} 컬럼) 키를 담을 자리가 없다 — 담으면
     * 읽는 시점의 언어로 번역해야 하고, 그러면 {@code TITLE} 이 키인지 문장인지 행마다
     * 달라진다.
     *
     * <p><b>이것이 다국어의 미결을 하나 남긴다</b> — 수신자의 언어가 처리 시점에
     * 알려져 있으므로({@code SYS_USER.LOCALE_CD}) 그 언어로 지어 넣는 것이 맞고,
     * 그 연결은 발송 템플릿(NOTI-04)이 서는 날 함께 온다.
     */
    private static String titleOf(ReqStatus to) {
        return to == ReqStatus.DONE ? "요청이 처리되었습니다" : "요청이 반려되었습니다";
    }

    /** 메모가 없으면 기본 문구 — 처리는 메모가 선택이다(screen/admin/system/noti-request/requirements.md). */
    private static String contentOf(ReqStatus to, String memo) {
        if (memo != null && !memo.isBlank()) {
            return memo;
        }
        return to == ReqStatus.DONE ? "요청이 처리되었습니다." : "요청이 반려되었습니다.";
    }
}
