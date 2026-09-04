package com.aiagent.domain.favorite.service;

import com.aiagent.domain.favorite.FavoriteMenu;
import com.aiagent.domain.favorite.entity.SysUserFavorite;
import com.aiagent.domain.favorite.repository.SysUserFavoriteRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 즐겨찾기 — UX-03 · 42 §7.
 *
 * <p><b>대상은 언제나 세션의 주인이다.</b> {@code userId} 는 컨트롤러가 {@code Principal}
 * 에서 꺼낸 값이며 요청 본문에서 오지 않는다 — 본문에 두는 순간 <i>"누구 것을 고치는가"</i>
 * 가 클라이언트가 보낸 값이 된다.
 *
 * <p><b>개수 상한을 두지 않는다</b>(42 §7). 많이 등록하면 목록이 스크롤될 뿐이고 그
 * 판단은 사용자 몫이다 — 조회조건(search-form-contract.md §5.5)에 상한이 있는 것은 그쪽이 <i>내용</i> 을
 * 담기 때문이다.
 *
 * <p><b>락이 없다</b>(42 §7). 데이터의 주인이 본인 한 명이고 지켜야 할 불변식이 없는
 * <b>평면 목록</b>이라, 메뉴 트리(42 §4)의 {@code @CustomLock} 규약을 그대로 복사하는
 * 것은 과하다 — 어긋나도 피해는 순서 하나다.
 *
 * <p><b>순서 재배치가 없다.</b> 42 §7 이 형태를 정해 두었지만 순서를 바꾸는 화면이 아직
 * 없고, 부르는 곳 없는 기능을 먼저 만들면 <b>쓰이지 않는 채 낡는다</b>. {@code SORT_NO} 는
 * 지금 <i>넣은 순서</i> 이며, 끌어 옮기는 화면이 오는 날 함께 만든다.
 */
@Service
@Transactional(readOnly = true)
public class FavoriteService {

    private final SysUserFavoriteRepository favorites;
    private final Clock clock;

    public FavoriteService(SysUserFavoriteRepository favorites, Clock clock) {
        this.favorites = favorites;
        this.clock = clock;
    }

    /**
     * 내 즐겨찾기 — 순서대로.
     *
     * <p><b>권한으로 거르지 않는다.</b> 거르는 자리는 화면이며, 화면이 가진 메뉴 트리가
     * 이미 유효 권한을 통과한 것이다(security-design.md §4 · main-shell.md §4.4). 여기서 한 번 더 거르면 <b>같은
     * 규칙이 두 곳</b>에 놓이고, 그 둘이 어긋나는 날 어느 쪽이 옳은지 알 수 없다.
     */
    public List<FavoriteMenu> findMine(String userId) {
        return favorites.findByUserIdOrderBySortNoAsc(userId).stream()
                .map(FavoriteService::toRecord)
                .toList();
    }

    /** 등록 — <b>이미 있으면 아무 일도 하지 않는다.</b> 결과가 같으므로 실패로 만들 이유가 없다. */
    @Transactional
    public void add(String userId, String menuCd) {
        if (favorites.existsByUserIdAndMenuCd(userId, menuCd)) {
            return;
        }
        favorites.save(
                SysUserFavorite.created(
                        userId, menuCd, favorites.findLastSortNo(userId) + 1, Instant.now(clock)));
    }

    /** 제거 — 없는 것을 지워도 성공이다(결과가 같다). */
    @Transactional
    public void remove(String userId, String menuCd) {
        favorites.deleteByUserIdAndMenuCd(userId, menuCd);
    }

    private static FavoriteMenu toRecord(SysUserFavorite entity) {
        return new FavoriteMenu(entity.getMenuCd(), entity.getSortNo(), entity.getCreDtm());
    }
}
