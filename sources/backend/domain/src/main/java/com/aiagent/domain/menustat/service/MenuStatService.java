package com.aiagent.domain.menustat.service;

import com.aiagent.domain.menustat.FrequentMenu;
import com.aiagent.domain.menustat.FrequentMenus;
import com.aiagent.domain.menustat.entity.SysUserMenuStat;
import com.aiagent.domain.menustat.repository.SysUserMenuStatRepository;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.MenuStatProps;
import com.aiagent.support.time.BusinessCalendar;
import java.time.Instant;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 자주 쓰는 메뉴 — UX-16 · sys/menu.md.
 *
 * <p><b>즐겨찾기 등록조차 하지 않는 사용자를 위한 것이다.</b> 그래서 <i>무엇을 세는가</i> 가
 * 이 기능의 전부이며, 세는 것은 <b>메뉴를 선택하는 행위</b> 하나다.
 *
 * <p><b>실시간 UPSERT 다.</b> 야간 배치를 먼저 택했다가 뒤집었는데, 비용을 <i>요청량</i>
 * 으로 계산한 것이 틀렸기 때문이다 — 실제 대상은 <b>메뉴 선택량</b> 이고 그것은 사람의
 * 클릭 속도로 제한된다. 실시간이 주는 것 둘: <b>첫날부터 동작하고</b>(배치면 신규
 * 사용자·메뉴가 다음 날까지 안 보인다), 집계 배치·실행 이력·재계산 로직이 <b>사라진다</b>.
 *
 * <p><b>세는 일이 실패해도 화면은 열린다.</b> 카운트는 부수 효과이며, 실패가 화면 진입을
 * 막으면 기능의 무게가 목적보다 커진다 — 부르는 쪽(프론트)도 응답을 기다리지 않는다.
 */
@Service
@Transactional(readOnly = true)
public class MenuStatService {

    private static final DateTimeFormatter YM = DateTimeFormatter.ofPattern("yyyyMM");

    private final SysUserMenuStatRepository stats;
    private final ConfigLookup configs;
    private final BusinessCalendar calendar;

    public MenuStatService(
            SysUserMenuStatRepository stats,
            ConfigLookup configs,
            BusinessCalendar calendar) {
        this.stats = stats;
        this.configs = configs;
        this.calendar = calendar;
    }

    /**
     * 이번 달 버킷 하나를 올린다.
     *
     * <p><b>같은 행을 한 달 내내 갱신한다</b> — 카운트만 오르고 행은 늘지 않는다.
     *
     * <p><b>동시 클릭의 경합을 막지 않는다.</b> PK 가 사용자를 포함하므로 다투는 상대는
     * <i>자기 자신의 다른 브라우저 탭</b>뿐이고, 어긋나도 잃는 것은 <b>카운트 하나</b>다 —
     * 그것을 지키려고 락을 걸면 부수 효과가 본 기능보다 무거워진다.
     */
    @Transactional
    public void record(String userId, String menuCd) {
        String statYm = currentYm();
        Instant now = calendar.now();

        stats.findByUserIdAndMenuCdAndStatYm(userId, menuCd, statYm)
                .ifPresentOrElse(
                        stat -> stat.count(now),
                        () -> stats.save(SysUserMenuStat.first(userId, menuCd, statYm, now)));
    }

    /**
     * 상위 N개 — <b>이번 달 포함 최근 몇 달</b>의 합계 순이다.
     *
     * <p><b>창이 필요하다.</b> 누적 카운터만 두면 2년 전에 많이 쓴 메뉴가 영구히 상위에
     * 남는다. 창을 3개월로 잡는 이유는 월초에 <b>이번 달 버킷이 며칠치뿐</b>이기 때문이며,
     * 이전 두 달이 순위를 받쳐 주어야 <b>1일에 목록이 비지 않는다</b>.
     */
    public FrequentMenus findMine(String userId) {
        MenuStatProps props = configs.get(MenuStatProps.class);
        String fromYm = YearMonth.from(calendar.today()).minusMonths(props.months() - 1L).format(YM);

        List<FrequentMenu> menus =
                stats.findTop(userId, fromYm, PageRequest.ofSize(props.topN())).stream()
                        .map(row -> new FrequentMenu((String) row[0], ((Number) row[1]).longValue()))
                        .toList();

        // 기간을 함께 낸다 — 목록만으로는 "무엇을 기준으로 자주인가" 를 알 수 없다.
        return new FrequentMenus(fromYm, menus);
    }

    /** 이번 달 — <b>업무 시간대</b>의 달이다(sys/INDEX.md). 자정 근처의 한 건이 옆 달로 새지 않게. */
    private String currentYm() {
        return YearMonth.from(calendar.today()).format(YM);
    }
}
