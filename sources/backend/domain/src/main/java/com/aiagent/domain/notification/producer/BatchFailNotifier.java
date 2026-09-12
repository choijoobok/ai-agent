package com.aiagent.domain.notification.producer;

import com.aiagent.domain.authz.repository.SysUserRoleRepository;
import com.aiagent.domain.batch.BatchResultCode;
import com.aiagent.domain.batch.repository.SysScheduleBatchRepository;
import com.aiagent.domain.notification.NotiType;
import com.aiagent.domain.notification.NotificationSender;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.NotiPolicyProps;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * 배치가 실패하면 알린다 — <b>BATCH-06</b> · screen/admin/system/batch/schedule/requirements.md · screen/admin/system/notice/requirements.md.
 *
 * <h2>부르는 곳이 하나다 — {@code BatchHistoryWriter}</h2>
 *
 * <p>{@code BatchRunner} 에는 {@code FAIL} 을 적는 자리가 <b>넷</b>이다(큐 적재 실패 ·
 * 구현 없음 · 예외 · 유령 청소). 거기에 각각 알림을 붙이면 <b>하나를 빠뜨린 것을 아무도
 * 모른다</b> — 그 경로는 드물게 타므로 운영에서 <i>알림이 안 왔다</i> 로만 드러난다.
 *
 * <p>그래서 <b>이력 행을 쓰는 자리</b>에 건다. 이력에 {@code FAIL} 이 남는 것과 알림이
 * 나가는 것이 <b>같은 사건의 두 면</b>이 되고, 새 실패 경로가 생겨도 이력을 적는 한
 * 알림은 따라온다.
 *
 * <h2>{@code LOST} 도 실패다</h2>
 *
 * <p>screen/admin/system/notice/requirements.md 는 <i>"러너가 {@code FAIL} 을 적을 때"</i> 로 적었지만 {@link
 * BatchResultCode#LOST} 를 함께 넣는다 — <b>프로세스가 죽어 결과를 못 적은 실행</b>이며
 * (screen/admin/system/batch/schedule/requirements.md 의 유령), 운영에서 그것은 실패보다 나쁘다: 아무도 안 죽였는데 사라졌다.
 * 알리지 않으면 <b>화면을 열어 봐야만</b> 알 수 있다.
 *
 * <p>{@code SKIP_LOCK} · {@code SKIP_COOLDOWN} · {@code CANCELED} 는 아니다 — 앞의 둘은
 * <b>설계대로 안 돈 것</b>이고(backend/persistence.md) 마지막은 <b>사람이 멈춘 것</b>이다.
 *
 * <h2>수신자가 역할이다</h2>
 *
 * <p>{@code sys-config.noti.batch-fail-role}(screen/admin/system/notice/requirements.md). screen/admin/system/batch/schedule/requirements.md 이 <i>"배치별 on/off 를
 * 두면 꺼 둔 것을 잊는다"</i> 며 <b>전역 설정 하나</b>로 정한 그것이며, 채널이 인앱뿐이라
 * 채널 키는 없다.
 *
 * <p><b>대상 0명을 로그에 남긴다.</b> 없는 역할을 적는 오타가 <i>조용히 아무도 안 받는</i>
 * 상태를 만드는데, 그 상태는 <b>배치가 실패할 때까지 드러나지 않는다</b> — 드러나야 할
 * 그 순간에 또 조용하면 안 된다.
 */
@Component
public class BatchFailNotifier {

    private static final Logger log = LoggerFactory.getLogger(BatchFailNotifier.class);

    /** screen/admin/system/batch/schedule/requirements.md 의 실행 이력 메뉴 — 알림을 누르면 그 화면이 열린다. */
    private static final String BATCH_HISTORY_MENU = "BATCH_HISTORY";

    private final NotificationSender notifications;
    private final SysUserRoleRepository userRoles;
    private final SysScheduleBatchRepository batches;
    private final ConfigLookup configs;

    public BatchFailNotifier(
            NotificationSender notifications,
            SysUserRoleRepository userRoles,
            SysScheduleBatchRepository batches,
            ConfigLookup configs) {
        this.notifications = notifications;
        this.userRoles = userRoles;
        this.batches = batches;
        this.configs = configs;
    }

    /** 알릴 결과인가 — 부르는 쪽이 이것으로 먼저 거른다(대개 성공이라 조회를 아낀다). */
    public static boolean isFailure(BatchResultCode rsltCd) {
        return rsltCd == BatchResultCode.FAIL || rsltCd == BatchResultCode.LOST;
    }

    /**
     * 실패 하나를 알린다 — <b>이력 트랜잭션 안에서</b> 불린다.
     *
     * <p>{@code BatchHistoryWriter} 가 {@code REQUIRES_NEW} 로 연 트랜잭션에 참여한다
     * ({@link NotificationSender} 가 새 트랜잭션을 열지 않는다). <b>이력이 커밋되면 알림도
     * 커밋된다</b> — 그 둘이 갈리면 *실패한 기록은 있는데 아무도 못 받은* 또는 *알림은
     * 갔는데 이력에 없는* 상태가 생긴다.
     *
     * <p><b>알림 실패가 이력을 되돌린다.</b> 그것이 맞는 방향이다: 실패 기록은 로그에도
     * 남지만(러너가 {@code log.error} 를 먼저 찍는다) <b>알림은 여기서만</b> 나간다.
     *
     * <h3>{@code LINK_PARAM} 이 {@code BATCH_ID} 인 이유</h3>
     *
     * <p>넘겨주기 채널({@code handoffStore})은 <b>화면당 값 하나</b>이고 <b>무엇인지
     * 모르는 문자열</b>이다. {@code BATCH_HISTORY} 의 그 한 자리는 이미 screen/admin/system/batch/schedule/requirements.md 의 왕복이
     * 쓰고 있으며 그 값은 <b>배치 ID</b> 다 — 실행 번호를 넣으면 받는 화면이 그것을 배치
     * ID 로 읽는다.
     *
     * @param histId 이력 번호 — <b>로그에만 쓴다.</b> 알림이 싣는 것은 배치 ID 다
     */
    public void notifyFailure(Long histId, String batchId, BatchResultCode rsltCd, String rsltMsg) {
        String roleId = configs.get(NotiPolicyProps.class).batchFailRole();
        if (roleId == null || roleId.isBlank()) {
            // 끈 배포다 — 설정이 그렇게 되어 있는 것이지 빠뜨린 것이 아니다.
            return;
        }

        List<String> receivers = userRoles.findUserIdsByRoleId(roleId);
        if (receivers.isEmpty()) {
            log.warn(
                    "배치 실패 알림을 받을 사람이 없다 — 역할 {} 보유자 0명 (batchId={} histId={})",
                    roleId,
                    batchId,
                    histId);
            return;
        }

        notifications.sendAll(
                receivers,
                NotiType.BATCH,
                titleOf(batchId, rsltCd),
                rsltMsg == null || rsltMsg.isBlank() ? "결과 메시지가 없습니다." : rsltMsg,
                BATCH_HISTORY_MENU,
                /*
                  **{@code HIST_ID} 가 아니라 {@code BATCH_ID} 다.** 처음에는 실행 번호를
                  실어 보냈는데, 그것을 받는 쪽이 없다 — 넘겨주기 채널은 **화면당 값
                  하나**이고 무엇인지 모르는 문자열이며(`handoffStore`),
                  {@code BATCH_HISTORY} 의 그 한 자리는 이미 <b>배치 ID</b> 가 쓰고 있다
                  (screen/admin/system/batch/schedule/requirements.md 의 왕복). 실행 번호를 넣으면 받는 화면이 그것을 배치 ID 로
                  읽어 <b>0건</b>을 보인다.

                  배치 ID 로 넘기면 그 배치의 실행이 조회된 채로 열리고, 방금 실패한
                  실행이 **맨 위**다(기본 정렬이 시작 역순이다 — screen/admin/system/batch/schedule/requirements.md). 실행 번호까지
                  집어 주는 것은 채널이 <i>무엇을</i> 넘기는지 말할 수 있게 되는 날의 일이다.
                */
                batchId);
    }

    /**
     * 제목에 <b>배치 이름</b>을 쓴다 — {@code BATCH_ID} 는 락 키이지 사람이 읽는 이름이
     * 아니다(screen/admin/system/batch/schedule/requirements.md).
     *
     * <p>이름을 못 찾으면 ID 를 그대로 쓴다. 등록이 지워진 뒤 남은 이력이 그 경우이며
     * (screen/admin/system/batch/schedule/requirements.md 이 삭제를 허용한다), <b>이름이 없다고 알림을 안 보낼 이유는 없다.</b>
     */
    private String titleOf(String batchId, BatchResultCode rsltCd) {
        String name = batches.findById(batchId)
                .map(batch -> batch.getBatchNm())
                .orElse(batchId);
        return rsltCd == BatchResultCode.LOST
                ? "배치 실행이 유실됐습니다 — " + name
                : "배치가 실패했습니다 — " + name;
    }
}
