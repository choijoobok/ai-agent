package com.aiagent.domain.authz.service;

import com.aiagent.domain.authz.ActionType;
import com.aiagent.domain.authz.entity.QSysApi;
import com.aiagent.domain.authz.entity.QSysMenu;
import com.aiagent.domain.authz.entity.QSysMenuApi;
import com.querydsl.core.Tuple;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * <b>메뉴마다 부여할 수 있는 액션</b> — sys/menu.md 의 액션 열을 데이터에서 만든다.
 *
 * <h2>원천이 둘이다</h2>
 *
 * <pre>
 *   정의된 액션 = 매핑된 API 가 말하는 액션  ∪  화면이 스스로 하는 액션
 *                 SYS_MENU_API ⋈ SYS_API        SYS_MENU.EXPORT_YN
 * </pre>
 *
 * <p>앞엣것이 backend/api.md 이 정한 규칙이다 — <i>"이 API 가 무엇을 하는가"</i> 는 개발 시점에
 * 정해진 사실이고 경로 접두가 그것을 말한다. 뒤엣것은 그 규칙이 <b>닿지 못하는 자리</b>이며,
 * {@code EXPORT} 하나뿐이다(sys/menu.md).
 *
 * <p><b>엑셀은 프론트가 만든다</b>(frontend/grid-advanced.md — 현재 페이지·전체). 서버 호출이 없으므로
 * {@code SYS_API} 행이 생기지 않고, API 에서 액션을 뽑는 사슬은 그 화면에 <b>아무것도
 * 주지 못한다.</b> 그 결과가 실물로 드러난 것이 역할 권한 화면이었다 — sys/menu.md 가 {@code E}
 * 를 준 메뉴 10개에 스위치가 서지 않았고, 004 가 준 부여는 <b>회수할 수단이 없는 고아</b>로
 * 남았다(2026-08-30).
 *
 * <h2>{@code EXPORT} 는 서버가 집행하지 않는다 — 그래서 이것은 <b>운영 정책</b>이다</h2>
 *
 * <p>부를 API 가 없다는 말은 <b>인가 인터셉터가 막을 요청도 없다</b>는 뜻이다
 * ({@link ApiAuthorityRegistry} 는 URL 로만 판정한다). {@code EXPORT} 를 실제로 집행하는 것은
 * <b>버튼을 그릴지 말지를 정하는 프론트</b>뿐이며, 데이터를 가져오는 경계는 여전히
 * {@code READ} 다 — 조회할 수 있는 사람은 화면에 뜬 것을 어떻게든 옮겨 적을 수 있다.
 *
 * <p><b>그래도 권한으로 두는 값이 있다.</b> <i>"이 사람에게 내려받기를 허용했는가"</i> 가
 * 데이터로 남고, 다운로드 기록(frontend/grid-advanced.md · {@code SYS_LO_ACCESS})과 짝을 이룬다. 유출을
 * <b>막는</b> 장치로 읽으면 안 되고, <b>정한 대로 운영되고 있는가</b> 를 묻는 장치다.
 *
 * <h2>매 호출 읽는다</h2>
 *
 * <p>{@link ApiAuthorityRegistry} 는 기동 시 한 번 적재하지만 여기는 그러지 않는다. 부르는
 * 곳이 <b>관리 화면 둘</b>(트리 조회 · 권한 저장)뿐이라 요청 수가 적고, 무엇보다 저장이
 * <b>같은 요청 안에서 다시 읽어</b> 조회 때와 같은 사실을 보는 것이 중요하다. 캐시를 두면
 * 무효화 신호가 하나 늘고, 그 신호를 빠뜨렸을 때의 증상이 <i>"권한을 줬는데 안 된다"</i> 다.
 */
@Service
public class MenuActionCatalog {

    private static final QSysMenuApi MA = QSysMenuApi.sysMenuApi;
    private static final QSysApi A = QSysApi.sysApi;
    private static final QSysMenu M = QSysMenu.sysMenu;

    private final JPAQueryFactory query;

    public MenuActionCatalog(JPAQueryFactory query) {
        this.query = query;
    }

    /**
     * {@code MENU_CD → 부여할 수 있는 액션}. 하나도 없는 메뉴는 <b>키가 없다</b>.
     *
     * <p><b>메뉴별로 세지 않고 한 번에 읽는다.</b> 매핑 전체가 수백 행이고 부르는 쪽은 트리
     * 전건이라 어차피 둘 다 통째로 필요하다 — {@code IN} 을 쪼갤 것도 없다.
     *
     * <p>{@link EnumSet} 이라 {@link ActionType} 선언 순서로 돈다 — 화면의 열 순서가 DB 가
     * 준 순서에 기대지 않는다.
     */
    @Transactional(readOnly = true)
    public Map<String, Set<ActionType>> definedActions() {
        Map<String, Set<ActionType>> byMenu = new HashMap<>();

        for (Tuple row : query.select(MA.menuCd, A.actionCd)
                .from(MA)
                .join(A).on(A.apiUrl.eq(MA.apiUrl))
                .fetch()) {
            actionsOf(byMenu, row.get(MA.menuCd)).add(row.get(A.actionCd));
        }
        /*
          <b>READ 가 있는 메뉴에만 붙인다.</b> 엑셀은 조회한 것을 내려받는 일이라 READ 없이는
          성립하지 않으며, screen/user/requirements.md 의 불변식이 그것을 이미 말하고 있다 — READ 없이 EXPORT 만
          담긴 저장은 서버가 거부한다. 그 검사를 그대로 두고 스위치만 그리면 <b>켤 수는
          있는데 저장이 안 되는 칸</b>이 생긴다.

          이 조건이 걸리는 것은 <b>아직 화면이 없는 메뉴</b>다. 052 §4.2 가 E 를 준 10개 중
          넷은 매핑된 API 가 하나도 없어(USER_MGMT · USER_AUTH_MGMT · BATCH_HISTORY ·
          ERROR_LOG) 004 의 READ 부여마저 고아인 상태이며, 그 화면이 서면 함께 살아난다.
          구조 노드가 걸러지는 것도 여기서 함께 끝난다 — 007 은 리프에만 API 를 매핑한다.
        */
        Set<String> declared = Set.copyOf(
                query.select(M.menuCd).from(M).where(M.exportYn.isTrue()).fetch());

        byMenu.forEach((menuCd, actions) -> {
            if (declared.contains(menuCd) && actions.contains(ActionType.READ)) {
                actions.add(ActionType.EXPORT);
            }
        });
        return byMenu;
    }

    private static Set<ActionType> actionsOf(Map<String, Set<ActionType>> byMenu, String menuCd) {
        return byMenu.computeIfAbsent(menuCd, key -> EnumSet.noneOf(ActionType.class));
    }
}
