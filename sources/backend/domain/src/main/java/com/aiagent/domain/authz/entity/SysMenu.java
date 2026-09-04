package com.aiagent.domain.authz.entity;

import com.aiagent.core.domain.BaseAuditEntity;
import com.aiagent.core.domain.YnConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 메뉴 — sys/menu.md.
 *
 * <p><b>{@code MENU_URL} 의 NULL 여부가 권한 대상 여부를 결정한다.</b> NULL 이면 순수 구조
 * 노드이며 권한 테이블에 들어오면 거부한다. 그리고 <b>URL 과 자식은 배타</b>이므로
 * {@code MENU_URL IS NULL} 과 <i>자식이 있다</i> 가 <b>같은 사실</b>이다 — 판정이 볼 것도 하나다.
 *
 * <p><b>{@code MENU_NM} 은 메뉴명이 아니라 메시지 키다</b>({@code menu.{MENU_CD}}). 명칭의
 * 단일 원본은 {@code SYS_MESSAGE} 이며, 저장 DTO 에 이 필드를 두지 않으므로 조작할 경로가
 * 구조적으로 없다(원칙 P1).
 *
 * <p><b>{@code UP_MENU_CD} 를 연관관계로 매핑하지 않는다.</b> {@code @ManyToOne} 을 걸면
 * 조상 역산이 <b>지연 로딩 N+1</b> 이 되고, 순환이 있는 데이터에서는 그 순회가 끝나지 않는다
 * (sys/menu.md 는 순환을 네 층으로 막지만 <i>이미 들어온</i> 데이터도 전제한다). 코드 문자열로
 * 두면 트리 전체를 한 번에 읽어 메모리에서 방문 집합과 깊이 상한을 걸 수 있다.
 */
@Entity
@Table(name = "SYS_MENU")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysMenu extends BaseAuditEntity {

    /** 트리 깊이 상한 — 리프 포함 5단(sys/menu.md). 순회 코드의 방어선이기도 하다. */
    public static final int MAX_DEPTH = 5;

    @Id
    @Column(name = "MENU_CD", length = 30, nullable = false)
    private String menuCd;

    @Column(name = "UP_MENU_CD", length = 30)
    private String upMenuCd;

    @Column(name = "MENU_NM", length = 100, nullable = false)
    private String menuNm;

    @Column(name = "MENU_URL", length = 200)
    private String menuUrl;

    @Column(name = "ICON_CD", length = 50)
    private String iconCd;

    @Column(name = "SORT_NO", nullable = false)
    private Integer sortNo;

    /**
     * 유효 권한 계산의 <b>최종 게이트</b> — backend/security.md.
     *
     * <p>여기만 OR 이 아니라 <b>AND</b> 다. 역할 하나가 권한을 갖고 있다고 되살아나면
     * 메뉴를 끄는 수단이 존재하지 않는 것과 같다.
     */
    @Convert(converter = YnConverter.class)
    @Column(name = "USE_YN", length = 1, nullable = false)
    private Boolean useYn;

    /**
     * 이 화면이 <b>엑셀을 내는가</b> — {@code EXPORT} 액션의 <b>정의</b>다(sys/menu.md).
     *
     * <p>다른 셋과 층이 다르다. {@code READ}·{@code SAVE}·{@code EXECUTE} 는 <b>매핑된 API 가
     * 말하고</b>(backend/api.md) 그것을 담을 자리는 {@code SYS_API.ACTION_CD} 다. {@code EXPORT} 만
     * 그 말이 닿지 않는다 — 엑셀은 <b>프론트가 만들고</b>(frontend/grid-advanced.md) 서버 호출이 없어
     * {@code SYS_API} 행이 생기지 않는다. 그래서 이 액션만 <b>메뉴가 직접 선언</b>한다.
     *
     * <p><b>{@code USE_YN} 과 혼동하지 않는다.</b> 저쪽은 유효 권한의 최종 게이트라 끄면
     * 이미 준 권한이 무효가 되고(backend/security.md ④), 이쪽은 <b>줄 수 있는 액션의 목록</b>이라 끄면
     * 애초에 줄 수 없다. 이미 준 부여는 남으며 <b>고아가 된다</b> — 지우는 것은 사람의
     * 판단이다(seed.md).
     *
     * <p><b>저장 DTO 에 두지 않는다.</b> 엑셀 버튼이 화면에 있는가는 개발 시점에 정해진
     * 사실이고, 운영에서 켤 수 있으면 <i>버튼 없는 화면에 출력 권한</i> 이 생긴다 —
     * 매핑을 시드로만 바꾸는 이유와 같다(backend/security.md · 원칙 P1).
     */
    @Convert(converter = YnConverter.class)
    @Column(name = "EXPORT_YN", length = 1, nullable = false)
    private Boolean exportYn;

    /**
     * 누가 이 메뉴를 만들었나 — seed.md · sys/menu.md.
     *
     * <p><b>{@code SEED}</b> 선언 파일에 있다 · <b>{@code USER}</b> 운영자가 만들었다 ·
     * <b>{@code ORPHAN}</b> 시드가 만들었는데 선언에서 사라졌다.
     *
     * <p>시드가 매 기동에서 다시 쓴다. {@code USER} 는 건드리지 않으므로 화면이 만든 메뉴가
     * 배포에서 살아남고, {@code ORPHAN} 은 <b>지워지지 않고 트리에 배지로</b> 뜬다(screen/menu/requirements.md) —
     * 지우는 것은 사람이다. API 카탈로그의 <i>미매핑</i>, 메시지의 <i>미사용</i> 과 같은 자리다.
     *
     * <p><b>저장 DTO 에 없다.</b> {@code EXPORT_YN} 과 같은 이유이며, 화면에서 바꾸면
     * 시드가 자기 것이 아닌 행을 덮거나 자기 것을 놓치게 된다.
     */
    @Column(name = "SRC_CD", length = 10, nullable = false)
    private String srcCd;

    /** 시드가 만들었는데 선언에서 사라졌다 — screen/menu/requirements.md 의 배지가 이것을 본다. */
    public boolean isOrphan() {
        return ORPHAN.equals(srcCd);
    }

    /** 운영자가 화면에서 만들었다는 표 — 시드가 건드리지 않는다. */
    public static final String USER = "USER";

    /** 시드가 만들었고 선언에 있다. */
    public static final String SEED = "SEED";

    /** 시드가 만들었는데 선언에서 사라졌다. */
    public static final String ORPHAN = "ORPHAN";

    /** 권한을 부여할 수 있는 대상인가 — 리프이고 살아 있는가. 게이트(④)가 묻는 것 전부다. */
    public boolean isAuthorizable() {
        return menuUrl != null && Boolean.TRUE.equals(useYn);
    }

    /**
     * 이 메뉴 이름의 메시지 키 — {@code menu.{MENU_CD}}(sys/menu.md · sys/code.md).
     *
     * <p><b>조립을 한 자리에 모은다.</b> 문자열을 부르는 쪽마다 만들면 접두를 바꿀 때
     * <b>고칠 자리가 흩어지고</b>, 하나만 빠뜨려도 그 메뉴만 이름이 안 나온다 —
     * {@code SysCode.messageKey} 와 같은 처리다.
     */
    public static String messageKey(String menuCd) {
        return "menu." + menuCd;
    }

    /**
     * 관리 화면이 만드는 노드 — screen/menu/requirements.md. <b>받는 것은 셋뿐이다.</b>
     *
     * <p>{@code MENU_NM} 은 {@link #messageKey} 로 서버가 조립하고, {@code MENU_URL}·
     * {@code ICON_CD} 는 만든 뒤 셀에서 채우며, {@code USE_YN} 은 {@code 'Y'} 로 시작한다 —
     * <b>사람이 정하는 값이 아닌 것을 인자로 열지 않는다</b>(원칙 P1). 특히 {@code MENU_NM}
     * 을 받으면 이름의 원본이 둘이 되고, 어긋났을 때 어느 쪽이 맞는지 알 수 없다(sys/menu.md).
     */
    public static SysMenu created(String upMenuCd, String menuCd, int sortNo) {
        SysMenu menu = new SysMenu();
        menu.menuCd = menuCd;
        menu.upMenuCd = upMenuCd;
        menu.menuNm = messageKey(menuCd);
        menu.sortNo = sortNo;
        menu.useYn = true;
        // 엑셀은 화면이 내는 것이라 새 메뉴는 낼 수 없는 것에서 시작한다 — 시드가 켠다.
        menu.exportYn = false;
        /*
          화면이 만든 것은 USER 다 — seed.md. DB 기본값도 USER 이지만 여기서 명시한다:
          기본값에 기대면 이 사실이 changelog 에만 있게 되고, 코드를 읽는 사람은 시드가
          이 행을 지우지 않는 이유를 찾지 못한다.
        */
        menu.srcCd = USER;
        return menu;
    }

    /**
     * URL 을 바꾼다 — <b>배타 검사는 서비스가 한다</b>.
     *
     * <p>자식이 있는가·권한 행이 있는가는 <b>다른 행을 봐야</b> 알 수 있고(sys/menu.md), 엔티티는
     * 자기 행만 안다. 여기서 검사하는 척하면 <b>반쪽짜리 방어</b>가 되어 서비스 쪽 검사를
     * 지워도 되는 것처럼 읽힌다.
     */
    public void changeUrl(String menuUrl) {
        this.menuUrl = menuUrl;
    }

    public void changeIcon(String iconCd) {
        this.iconCd = iconCd;
    }

    /**
     * 사용 여부 — <b>전파는 서비스가 한다</b>(screen/menu/requirements.md).
     *
     * <p>구조 노드에 놓으면 자기와 자손 전체에 같은 값을 쓰는데, 그 순회는 트리를 알아야
     * 한다. 엔티티는 자기 값만 바꾸고 <b>몇 번 불릴지는 서비스가 정한다.</b>
     */
    public void changeUseYn(boolean useYn) {
        this.useYn = useYn;
    }

    /**
     * 부모와 순서를 함께 바꾼다 — <b>둘이 한 연산인 것이 계약이다</b>(sys/menu.md).
     *
     * <p>따로 열면 <i>부모만 바뀌고 순서는 옛 형제의 것</i> 인 중간 상태가 생긴다. sys/menu.md 가
     * 위치 연산을 메서드 하나로 모으라고 한 이유가 저장 서비스에만 있는 것이 아니다.
     *
     * <p><b>여기에도 순환 검사가 없다.</b> 조상 사슬 전체를 봐야 하므로 자기 행만 아는
     * 엔티티가 답할 수 없다 — 저장 서비스와 락이 그것을 한다(sys/menu.md · backend/persistence.md).
     */
    public void moveTo(String upMenuCd, int sortNo) {
        this.upMenuCd = upMenuCd;
        this.sortNo = sortNo;
    }
}
