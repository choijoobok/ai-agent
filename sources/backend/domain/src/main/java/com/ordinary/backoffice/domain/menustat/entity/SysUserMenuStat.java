package com.ordinary.backoffice.domain.menustat.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 자주 쓰는 메뉴의 월 버킷 — UX-16 · 42 §8.
 *
 * <p><b>세는 것은 "메뉴를 선택하는 행위" 하나다.</b> 탭바에서 탭을 고르는 것은 이미 열려
 * 있어 <b>찾는 수고가 없고</b>, 화면 안의 기능 버튼은 <i>사용 강도</i> 이지 여는 횟수가
 * 아니다 — 게다가 화면마다 버튼 수가 달라 <b>화면 설계가 순위를 왜곡</b>한다.
 *
 * <p><b>월 버킷이다.</b> 일 버킷 + 30일 창은 창이 정확한 대신 행이 30배인데, 이 기능이
 * 내는 답은 <i>"상위 N개와 그 순서"</i> 라 창 경계가 며칠 흔들려도 답이 거의 바뀌지 않는다.
 *
 * <p><b>감사 4컬럼이 없다.</b> 애플리케이션이 기계적으로 쓰며 <i>"누가"</i> 가 존재하지
 * 않는다(40 §4.2).
 */
@Entity
@Table(name = "SYS_USER_MENU_STAT")
@IdClass(SysUserMenuStatId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysUserMenuStat {

    @Id
    @Column(name = "USER_ID", length = 30, nullable = false)
    private String userId;

    @Id
    @Column(name = "MENU_CD", length = 30, nullable = false)
    private String menuCd;

    /**
     * 집계 월 {@code yyyyMM} — <b>업무 시간대 기준</b>이다(40 §4.3).
     *
     * <p>{@code date} 에 매월 1일을 넣지 않는 이유는 그것이 <i>"1일에 일어난 일"</i> 로
     * 읽히고 15일이 들어간 행을 막을 방법이 없기 때문이다. 문자열은 <b>사전순이 곧
     * 시간순</b>이라 {@code >=} 비교가 그대로 성립한다.
     *
     * <p><b>컬럼은 {@code VARCHAR(6)} 이다</b> — 42 §8 은 {@code CHAR(6)} 으로 적었으나
     * 컨버터 없는 순수 {@code String} 을 Hibernate 는 {@code VARCHAR} 로 잡아 <b>기동이
     * 검증에서 실패했다</b>(2026-08-30 실물). db-portability.md §4.3 이 Y/N 에서 이미 겪은 자리이며,
     * 그쪽의 답(컨버터의 DB 타입을 {@code Character} 로)은 컨버터가 있을 때의 것이다.
     * 길이가 늘 6인 것은 <b>{@code yyyyMM} 을 만드는 쪽</b>이 지킨다.
     */
    @Id
    @Column(name = "STAT_YM", length = 6, nullable = false)
    private String statYm;

    @Column(name = "USE_CNT", nullable = false)
    private Integer useCnt;

    /** 합계가 같을 때의 정렬 보조 — 최근에 쓴 것이 위로 온다. */
    @Column(name = "LAST_USE_DTM", nullable = false)
    private Instant lastUseDtm;

    public static SysUserMenuStat first(String userId, String menuCd, String statYm, Instant now) {
        SysUserMenuStat entity = new SysUserMenuStat();
        entity.userId = userId;
        entity.menuCd = menuCd;
        entity.statYm = statYm;
        entity.useCnt = 1;
        entity.lastUseDtm = now;
        return entity;
    }

    public void count(Instant now) {
        this.useCnt += 1;
        this.lastUseDtm = now;
    }
}
