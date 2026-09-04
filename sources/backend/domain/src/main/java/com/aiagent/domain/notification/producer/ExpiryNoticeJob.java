package com.aiagent.domain.notification.producer;

import com.aiagent.domain.authz.entity.QSysRole;
import com.aiagent.domain.authz.entity.QSysUserMenuAuth;
import com.aiagent.domain.authz.entity.QSysUserRole;
import com.aiagent.domain.batch.BatchJob;
import com.aiagent.domain.batch.BatchJobContext;
import com.aiagent.domain.batch.BatchJobResult;
import com.aiagent.domain.notification.NotiType;
import com.aiagent.domain.notification.NotificationSender;
import com.aiagent.domain.message.service.MessageService;
import com.aiagent.domain.notification.repository.SysNotiInboxRepository;
import com.aiagent.domain.user.entity.QSysUser;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.AuthPasswordProps;
import com.aiagent.support.config.props.MessageProps;
import com.aiagent.support.config.props.NotiPolicyProps;
import com.aiagent.support.time.BusinessCalendar;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 만료를 <b>미리 알린다</b> — AUTH-05(비밀번호) · AUTHZ-08(권한). 66 §6.2 의 <i>만료 점검
 * 배치</i> 다.
 *
 * <h2>만료를 <i>처리</i> 하지 않는다 — 이름이 그렇게 붙은 이유</h2>
 *
 * <p>security-design.md §4 가 <b>만료 판정을 조회 시 계산</b>으로 못박았다(계정 잠금 자동 해제와 같은
 * 구조 — 컬럼은 원시 데이터, 판정은 파생). 그래서 이 배치는 <b>행을 하나도 바꾸지
 * 않는다</b> — 넣는 것은 알림뿐이다. {@code ExpiryProcessJob} 같은 이름을 피한 것이
 * 그 사실을 지키는 첫 방어이며, <b>이 배치가 실패해도 권한 판정은 정확하다.</b>
 *
 * <h2>하는 일이 통보 하나다 — security-design.md §4 가 이력 기록을 물렸다 (2026-08-31)</h2>
 *
 * <p>그 문서는 AUTHZ-08 을 <i>캐시 무효화 · 이력 기록 · 만료 예정 통보</i> 셋으로 정의했고
 * ADR-0017 이 첫째를 뺐다. 남은 <b>이력 기록도 물렸다</b> — 적을 테이블을 ADR-0010 이
 * 만들지 않기로 했고 42 §3.1 이 {@code VALID_TO_DT} 를 그 자리로 정했다.
 *
 * <p><b>그리고 그것은 애초에 배치의 일이 아니었다.</b> 자동 만료는 <b>저장이 일어나지
 * 않는다</b> — 날짜가 지나갔을 뿐이라 이 배치가 쓸 행이 없다. 이력이 필요한 프로젝트가
 * 좁은 표를 더한다면 그 행을 쓰는 곳은 <b>부여·회수 저장 경로</b>다.
 *
 * <h2>받는 사람이 본인이다</h2>
 *
 * <p>42 §10 이 <i>"역할 부여 만료 예고 — 알림은 <b>수신자를 정할 수 없다</b>(부여자인지
 * 관리자 전원인지 조직마다 다르다)"</i> 로 관리자 알림을 닫고 조회 조건으로 답했다
 * (61 §3.3 의 {@code 역할 만료 예정 N일}). <b>그것과 어긋나지 않는다</b> — 여기서 받는
 * 사람은 <b>권한이 사라질 당사자</b>이고 그 수신자는 자명하다.
 *
 * <p>그리고 당사자에게는 <b>할 일이 있다</b>. 60 §8.3 이 <i>새 요청</i> 을 세우면서
 * 연장을 신청할 경로가 생겼다 — 알림이 그 경로의 입구다. 관리자 쪽은 조회가 답한다.
 *
 * <h2>같은 말을 매일 하지 않는다</h2>
 *
 * <p>예고 창이 며칠짜리라 순진하게 짜면 창이 열려 있는 동안 <b>매일 같은 사람에게</b>
 * 같은 말을 한다 — 그것은 알림이 아니라 소음이고, 소음이 되는 순간 사람은 배지를 보지
 * 않는다. {@code findUserIdsNotifiedSince} 가 <b>되돌아보는 창을 예고 기간과 같게</b>
 * 잡아 한 창에 한 번으로 만든다.
 *
 * <h2>보낼 사람이 없는 날이 대부분이다</h2>
 *
 * <p>그것이 정상이며 {@code SUCCESS} 다. 요약 문구가 <i>0건</i> 을 말하는 것이 중요한데,
 * 65 §4.3 이 <i>"어제 안 돌았는데 왜"</i> 를 이력 화면의 물음으로 든 것과 같은 자리다 —
 * <b>돌았는데 대상이 없었던 것</b>과 <b>안 돈 것</b>이 화면에서 구분돼야 한다.
 */
@Component
public class ExpiryNoticeJob implements BatchJob {

    private static final QSysUser U = QSysUser.sysUser;
    private static final QSysUserRole UR = QSysUserRole.sysUserRole;
    private static final QSysUserMenuAuth UA = QSysUserMenuAuth.sysUserMenuAuth;
    private static final QSysRole R = QSysRole.sysRole;

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final JPAQueryFactory query;
    private final NotificationSender notifications;
    private final SysNotiInboxRepository inboxes;
    private final MessageService messages;
    private final ConfigLookup configs;
    private final BusinessCalendar calendar;

    public ExpiryNoticeJob(
            JPAQueryFactory query,
            NotificationSender notifications,
            SysNotiInboxRepository inboxes,
            MessageService messages,
            ConfigLookup configs,
            BusinessCalendar calendar) {
        this.query = query;
        this.notifications = notifications;
        this.inboxes = inboxes;
        this.messages = messages;
        this.configs = configs;
        this.calendar = calendar;
    }

    /**
     * 둘을 차례로 본다 — 비밀번호, 그다음 권한.
     *
     * <p><b>한 트랜잭션이다.</b> 파기 배치가 청크마다 여는 것과 갈리는데, 여기서 다루는
     * 양이 <i>예고 창에 걸린 사람</i> 뿐이라 청크가 필요 없기 때문이다. 그리고 한
     * 트랜잭션이면 <b>절반만 보낸 상태</b>가 남지 않는다 — 알림은 되돌릴 수 없으므로
     * (읽은 사람이 있다) 실패했을 때 아무것도 안 간 편이 낫다.
     *
     * <p><b>중단은 둘 사이에서만 본다</b>(46 §6.2 의 협조적 중단). 안에서 보면 보낸 것을
     * 롤백해야 하고, 그러면 <i>중단했는데 절반이 갔다</i> 가 된다.
     */
    @Override
    @Transactional
    public BatchJobResult run(BatchJobContext context) {
        AuthPasswordProps password = configs.get(AuthPasswordProps.class);
        NotiPolicyProps policy = configs.get(NotiPolicyProps.class);

        List<String> summary = new ArrayList<>();
        List<String> detail = new ArrayList<>();

        int passwords = notifyPasswordExpiry(password, detail);
        summary.add("비밀번호 " + passwords + "명");

        if (context.isCancelRequested()) {
            detail.add("권한 만료 예고는 중단으로 건너뛰었다.");
            return BatchJobResult.canceled(String.join(" · ", summary) + " — 중단됨");
        }

        int authorities = notifyAuthorityExpiry(policy, detail);
        summary.add("권한 " + authorities + "명");

        return BatchJobResult.of(
                String.join(" · ", summary) + " — 모두 " + (passwords + authorities) + "명",
                String.join("\n", detail));
    }

    /**
     * 비밀번호 만료 예고 — AUTH-05.
     *
     * <p><b>날짜 계산을 SQL 로 보내지 않는다</b>(db-portability.md §4.5). {@code PWD_CHG_DTM + 90일} 을
     * DB 에서 더하면 벤더마다 다른 함수가 되고 <i>지금</i> 도 DB 의 시계가 된다. 대신
     * <b>기준을 뒤집어</b> 창의 양끝을 애플리케이션이 계산해 넣는다 — 만료일이
     * {@code [지금, 지금+예고]} 라는 말은 {@code PWD_CHG_DTM} 이
     * {@code [지금-만료, 지금+예고-만료]} 라는 말과 같다.
     *
     * <p><b>남은 일수별로 묶어 보낸다.</b> 문구에 그 숫자가 들어가야 하는데(<i>"7일 후"</i>)
     * 사람마다 다르므로 한 번에 보낼 수 없다 — 대신 같은 숫자끼리 묶으면 호출이 많아야
     * 예고 일수만큼이고, {@code sendAll} 이 그 묶음을 JDBC 배치로 넣는다.
     */
    private int notifyPasswordExpiry(AuthPasswordProps props, List<String> detail) {
        int expireDays = props.expireDays();
        int noticeDays = props.expireNoticeDays();

        if (expireDays <= 0 || noticeDays <= 0) {
            // 주기 만료를 끈 배포다 — 알릴 만료가 없다.
            detail.add("비밀번호 만료 예고: 꺼져 있다(expire-days=" + expireDays
                    + " · expire-notice-days=" + noticeDays + ").");
            return 0;
        }

        Instant now = calendar.now();
        Instant from = now.minus(Duration.ofDays(expireDays));
        Instant to = now.plus(Duration.ofDays(noticeDays - (long) expireDays));

        List<Tuple> found = query.select(U.userId, U.pwdChgDtm)
                .from(U)
                .where(noticeWorthy(calendar.today()), U.pwdChgDtm.between(from, to))
                .fetch();

        Set<String> already = Set.copyOf(
                inboxes.findUserIdsNotifiedSince(
                        NotiType.AUTH, now.minus(Duration.ofDays(noticeDays))));

        // 남은 일수 → 그 날짜에 걸린 사람들. TreeMap 이라 상세 문구가 임박한 순으로 나온다.
        Map<Long, List<String>> byRemaining = new TreeMap<>();
        for (Tuple row : found) {
            String userId = row.get(U.userId);
            if (already.contains(userId)) {
                continue;
            }
            Instant deadline = row.get(U.pwdChgDtm).plus(Duration.ofDays(expireDays));
            byRemaining
                    .computeIfAbsent(remainingDays(deadline), key -> new ArrayList<>())
                    .add(userId);
        }

        int sent = 0;
        for (Map.Entry<Long, List<String>> group : byRemaining.entrySet()) {
            long remaining = group.getKey();
            notifications.sendAll(
                    group.getValue(),
                    NotiType.AUTH,
                    "비밀번호 만료 예정",
                    remaining <= 0
                            ? "오늘 안에 비밀번호를 변경해야 합니다."
                            : remaining + "일 후 비밀번호를 변경해야 합니다.",
                    /*
                      **이동 링크가 없다.** 비밀번호 변경은 메뉴가 아니라 프로필 모달의
                      탭이고(60 §6), 모달에는 MENU_CD 가 없다(60 §1.1) — 요청 처리 알림이
                      링크 없이 가는 것과 같은 자리다(66 §5.4).
                    */
                    null,
                    null);
            sent += group.getValue().size();
            detail.add("비밀번호 D-" + remaining + ": " + group.getValue().size() + "명");
        }
        if (sent == 0) {
            detail.add("비밀번호 만료 예고: 보낼 사람이 없다(예고 " + noticeDays + "일).");
        }
        return sent;
    }

    /**
     * <b>몇 밤 남았는가</b> — 시각 차이가 아니라 <b>날짜 차이</b>다.
     *
     * <p>{@code Duration.between(...).toDays()} 로 세면 <b>버림</b>이 된다: 87일 전에 바꾼
     * 비밀번호(만료 90일)는 <i>2일 23시간 54분</i> 남았고 그 값은 <b>2</b> 다 — 사람은
     * 그것을 <i>"3일 후"</i> 라고 부른다. 브라우저에서 실제로 <i>"2일 후"</i> 가 찍혀
     * 드러났다.
     *
     * <p>기준 날짜는 <b>업무 시간대</b>의 오늘이다(40 §4.3) — 자정 근처에 도는 배치라
     * 서버의 시스템 시간대로 세면 하루가 어긋난다.
     */
    private long remainingDays(Instant deadline) {
        return ChronoUnit.DAYS.between(
                calendar.today(), LocalDate.ofInstant(deadline, calendar.zone()));
    }

    /**
     * 권한 만료 예고 — AUTHZ-08.
     *
     * <p><b>둘을 함께 센다</b> — 역할 부여({@code SYS_USER_ROLE})와 개인 예외
     * ({@code SYS_USER_MENU_AUTH}). 42 §3.1 이 성격을 갈라 두었지만 <b>당사자에게는 같은
     * 사건</b>이다: 곧 무언가가 안 보이게 된다.
     *
     * <p><b>사람당 한 통이다.</b> 권한 다섯 개가 같은 날 끝나면 다섯 통이 아니라 한 통이며,
     * 그래야 <i>"권한 N건"</i> 이라는 말이 성립한다.
     *
     * <p><b>무기한 부여는 대상이 아니다</b> — {@code VALID_TO_DT} 가 {@code null} 이면
     * 만료가 없다(역할 부여만 그럴 수 있다 · 42 §3.1). {@code between} 이 그것을 저절로
     * 거른다.
     */
    private int notifyAuthorityExpiry(NotiPolicyProps policy, List<String> detail) {
        int noticeDays = policy.authzExpireNoticeDays();
        LocalDate today = calendar.today();
        LocalDate until = today.plusDays(noticeDays);

        /*
          **양끝을 포함한다** — VALID_TO_DT 는 그날까지 유효하다는 뜻이다(42 §3.1 ·
          40 §4.3). 오늘 끝나는 것을 빼면 "오늘이 마지막 날" 을 알릴 기회가 없다.
        */
        Map<String, Expiring> byUser = new LinkedHashMap<>();

        for (Tuple row : query.select(UR.userId, R.roleNm, UR.validToDt)
                .from(UR)
                .join(R)
                .on(R.roleId.eq(UR.roleId))
                .where(UR.validToDt.between(today, until))
                .fetch()) {
            add(byUser, row.get(UR.userId), row.get(R.roleNm), row.get(UR.validToDt));
        }

        String lang = configs.get(MessageProps.class).defaultLang();
        for (Tuple row : query.select(UA.userId, UA.menuCd, UA.validToDt)
                .from(UA)
                .where(UA.validToDt.between(today, until))
                .fetch()) {
            add(byUser, row.get(UA.userId), menuName(row.get(UA.menuCd), lang), row.get(UA.validToDt));
        }

        if (byUser.isEmpty()) {
            detail.add("권한 만료 예고: 보낼 사람이 없다(예고 " + noticeDays + "일).");
            return 0;
        }

        Set<String> already = Set.copyOf(inboxes.findUserIdsNotifiedSince(
                NotiType.AUTHZ, calendar.now().minus(Duration.ofDays(noticeDays))));

        /*
          **계정 상태를 여기서 거른다.** 권한 쪽 질의는 SYS_USER 를 조인하지 않는데, 조인을
          더하면 같은 조건이 쿼리 둘에 복사된다 — 사람 수가 적은 자리라 손에 쥔 뒤 한 번
          거르는 편이 규칙을 한 곳에 남긴다.
        */
        Set<String> worthy = Set.copyOf(
                query.select(U.userId).from(U).where(noticeWorthy(today)).fetch());

        int sent = 0;
        for (Map.Entry<String, Expiring> entry : byUser.entrySet()) {
            String userId = entry.getKey();
            if (already.contains(userId) || !worthy.contains(userId)) {
                continue;
            }
            Expiring expiring = entry.getValue();
            notifications.send(
                    userId,
                    NotiType.AUTHZ,
                    expiring.names().size() == 1
                            ? expiring.names().get(0) + " 권한이 곧 만료됩니다"
                            : "권한 " + expiring.names().size() + "건이 곧 만료됩니다",
                    expiring.earliest().format(DATE) + "부터 순차로 만료됩니다 — "
                            + String.join(" · ", expiring.names())
                            + ". 계속 필요하면 알림의 내 요청 탭에서 신청하세요.");
            sent++;
        }
        detail.add("권한 만료 예고: 대상 " + byUser.size() + "명 중 " + sent + "명에게 보냈다.");
        return sent;
    }

    /**
     * 메뉴 이름 — <b>{@code MENU_CD} 를 그대로 보이지 않는다</b>.
     *
     * <p>{@code SYS_MENU.MENU_NM} 은 이름이 아니라 <b>메시지 키</b>({@code menu.{MENU_CD}})다
     * (43 §3). 그것을 풀지 않으면 사용자에게 <i>"BATCH_HISTORY 권한이 곧 만료됩니다"</i> 가
     * 가고, 그 말은 <b>아무 뜻도 없다</b> — 브라우저에서 그렇게 찍혀 드러났다.
     *
     * <p><b>기본 언어로 푼다.</b> 문장 전체가 그 언어로 지어지고 있으므로 이름만 수신자의
     * 언어로 푸는 것은 <b>한 문장에 두 언어</b>가 된다. 수신자 언어로 문장 전체를 짓는
     * 것은 발송 템플릿(NOTI-04)이 서는 날의 일이며 {@code NotiRequestService} 가 같은
     * 자리에 그 미결을 적어 두었다.
     *
     * <p><b>못 찾으면 코드를 쓴다</b> — {@code text(...)} 는 못 찾을 때 <i>키</i> 를
     * 돌려주는데({@code menu.BATCH_HISTORY}) 그것은 코드보다 나쁘다.
     */
    private String menuName(String menuCd, String lang) {
        return messages.find("menu." + menuCd, lang).orElse(menuCd);
    }

    private static void add(
            Map<String, Expiring> byUser, String userId, String name, LocalDate validToDt) {
        byUser.computeIfAbsent(userId, key -> new Expiring(validToDt)).add(name, validToDt);
    }

    /**
     * <b>알릴 값어치가 있는 계정인가.</b>
     *
     * <p>{@code LOCK_YN} 과 {@code DORMANT_YN} 을 보지 않는 것이 결정이다 — <b>일시적
     * 상태</b>이고 풀리면 그 알림을 본다(66 §5.7.1 이 미사용 계정의 요청 처리를 막지 않은
     * 것과 같은 방향). 오히려 잠긴 사람일수록 <i>비밀번호가 곧 만료된다</i> 를 알아야 한다.
     *
     * <p>{@code USE_YN} 과 계정 기간은 <b>돌아오지 않을 수 있는</b> 상태라 거른다 —
     * 퇴사자에게 비밀번호를 바꾸라고 알리는 것은 아무도 안 볼 알림함을 채우고, 90일 뒤
     * 파기 배치가 그것을 지운다.
     *
     * <p>기간은 <b>양끝 포함</b>이다(40 §4.3) — {@code null} 이면 제한이 없다.
     */
    private static BooleanExpression noticeWorthy(LocalDate today) {
        return U.useYn.isTrue()
                .and(U.validFromDt.isNull().or(U.validFromDt.loe(today)))
                .and(U.validToDt.isNull().or(U.validToDt.goe(today)));
    }

    /**
     * 사람 하나에게 걸린 것 — 이름들과 <b>가장 이른</b> 만료일.
     *
     * <p><b>레코드가 아니라 가변 객체다.</b> 맵에 담긴 채로 자라야 하는데
     * {@code computeIfAbsent(...)} 가 돌려준 것에 대고 새 인스턴스를 만들면 <b>맵에는
     * 옛 것이 남는다</b> — 불변으로 쓰려면 {@code merge} 로 다시 넣어야 하고, 그 두 줄이
     * 갈라지는 순간 <i>가장 이른 날짜</i> 가 조용히 틀린다.
     */
    private static final class Expiring {

        private final List<String> names = new ArrayList<>();
        private LocalDate earliest;

        private Expiring(LocalDate first) {
            this.earliest = first;
        }

        private void add(String name, LocalDate validToDt) {
            names.add(name);
            if (validToDt.isBefore(earliest)) {
                earliest = validToDt;
            }
        }

        private List<String> names() {
            return names;
        }

        private LocalDate earliest() {
            return earliest;
        }
    }
}
