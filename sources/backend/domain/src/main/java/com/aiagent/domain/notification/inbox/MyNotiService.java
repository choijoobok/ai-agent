package com.aiagent.domain.notification.inbox;

import com.aiagent.core.error.BusinessException;
import com.aiagent.domain.notification.entity.SysNotiInbox;
import com.aiagent.domain.notification.repository.SysNotiInboxRepository;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.NotiProps;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * <i>내 알림</i> — frontend/tabs.md · screen/_standalone/README.md. {@link com.aiagent.domain.notification.NotificationSender}
 * 가 <b>넣는 쪽</b>이고 여기가 <b>읽는 쪽</b>이다.
 *
 * <h2>대상이 언제나 세션의 주인이다</h2>
 *
 * <p>모든 메서드가 {@code userId} 를 <b>조건으로</b> 받으며, 그것이 이 서비스의 인가
 * 전부다 — 알림 모달에는 {@code MENU_CD} 가 없어(screen/_standalone/README.md) {@code (메뉴, 액션)} 판정을
 * 걸 자리가 없다. 판정 대신 <b>범위가 좁다</b>: 남의 번호를 넣으면 <i>없는 것</i>이다.
 *
 * <h2>읽음은 두 경로뿐이다 — frontend/tabs.md</h2>
 *
 * <table><caption></caption>
 * <tr><td>항목을 열었다</td><td>그 항목만</td></tr>
 * <tr><td>목록을 열었다</td><td><b>아무것도 하지 않는다</b> — 훑어만 봐도 배지가 사라지면
 *     놓친 알림을 찾을 수 없다</td></tr>
 * <tr><td><i>모두 읽음</i> 버튼</td><td>전부. <b>사용자가 의도적으로 비우는 경로</b></td></tr>
 * </table>
 *
 * <p>가운데 줄이 <b>없는 메서드</b>로 집행된다 — 목록 조회가 {@code readOnly} 다.
 */
@Service
@Transactional(readOnly = true)
public class MyNotiService {

    private final SysNotiInboxRepository inboxes;
    private final ConfigLookup configs;
    private final Clock clock;

    public MyNotiService(SysNotiInboxRepository inboxes, ConfigLookup configs, Clock clock) {
        this.inboxes = inboxes;
        this.configs = configs;
        this.clock = clock;
    }

    /** 목록 · 미읽음 · 전건을 한 번에 — {@link MyNotifications} 가 셋을 함께 주는 이유다. */
    public MyNotifications findMine(String userId) {
        int limit = configs.get(NotiProps.class).listSize();

        List<MyNotiRow> rows =
                inboxes.findByUserIdOrderByCreDtmDescNotiIdDesc(userId, PageRequest.ofSize(limit))
                        .stream()
                        .map(MyNotiService::rowOf)
                        .toList();

        return new MyNotifications(rows, countUnread(userId), inboxes.countByUserId(userId));
    }

    /**
     * 배지 하나 — frontend/tabs.md.
     *
     * <p><b>목록과 따로 부를 수 있어야 한다.</b> 벨은 모달을 열지 않은 채로도 숫자를
     * 보여야 하고, 그때 알림 본문을 통째로 받는 것은 낭비다.
     */
    public long countUnread(String userId) {
        return inboxes.countByUserIdAndReadYn(userId, false);
    }

    /**
     * 이 항목을 읽었다 — <b>내 것일 때만</b>.
     *
     * <p>남의 번호나 이미 파기된 번호면 거부한다. 조용히 넘기지 않는 것은 화면이
     * <i>읽음으로 바뀐 줄 알고</i> 배지를 깎기 때문이다 — 그러면 새로고침할 때 숫자가
     * 되돌아온다.
     */
    @Transactional
    public void markRead(String userId, Long notiId) {
        SysNotiInbox noti = inboxes.findByNotiIdAndUserId(notiId, userId)
                .orElseThrow(() -> new BusinessException(
                        NotiInboxErrorCode.NOT_FOUND, "내 알림이 아니다 — " + notiId));
        noti.markRead(clock.instant());
    }

    /**
     * 모두 읽음 — frontend/tabs.md 가 <b>두기로 한</b> 명시적 경로다.
     *
     * <p><b>벌크 UPDATE 가 아니라 엔티티를 읽어 고친다.</b> 한 줄로 끝나는 것을 굳이
     * 그러는 이유는 {@link SysNotiInbox#markRead} 가 갖는 규칙 때문이다 — <i>이미 읽은
     * 것의 {@code READ_DTM} 을 덮지 않는다</i>. 벌크로 쓰면 그 규칙이 <b>두 곳</b>에
     * 생기고, 한쪽만 고치는 날이 온다.
     *
     * <p>양이 문제가 되지 않는 것은 대상이 <b>한 사람의 안 읽은 것</b>이고 보존이
     * 90일이기 때문이다(retention.md).
     *
     * @return 읽음으로 바꾼 건수 — 화면이 <i>"N건을 읽음으로 표시했습니다"</i> 를 낼 수 있다
     */
    @Transactional
    public int markAllRead(String userId) {
        Instant now = clock.instant();
        List<SysNotiInbox> unread = inboxes.findByUserIdAndReadYn(userId, false);
        unread.forEach(noti -> noti.markRead(now));
        return unread.size();
    }

    private static MyNotiRow rowOf(SysNotiInbox noti) {
        return new MyNotiRow(
                noti.getNotiId(),
                noti.getNotiTypeCd(),
                noti.getTitle(),
                noti.getContent(),
                noti.getLinkMenuCd(),
                noti.getLinkParam(),
                noti.getReadYn(),
                noti.getCreDtm());
    }
}
