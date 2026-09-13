package com.aiagent.domain.gridpref.service;

import com.aiagent.core.error.BusinessException;
import com.aiagent.core.error.CommonErrorCode;
import com.aiagent.domain.authz.repository.SysMenuRepository;
import com.aiagent.domain.gridpref.GridPref;
import com.aiagent.domain.gridpref.entity.SysUserGridPref;
import com.aiagent.domain.gridpref.repository.SysUserGridPrefRepository;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 그리드 개인화 — UX-06 · UX-13 · frontend/grid.md.
 *
 * <p><b>시그니처 판정이 이 클래스의 요점이다.</b> 화면은 지금의 컬럼 목록으로 만든 시그니처를
 * 들고 물으며, 저장된 것과 다르면 <b>그 행을 지우고 없다고 답한다</b> — 살려 두면 다음
 * 저장 때까지 <i>맞지 않는 설정</i> 이 DB 에 남고, 그것이 다른 기기에서 다시 읽힌다.
 *
 * <p><b>버리는 것이 조용하다.</b> sys/INDEX.md 의 <i>실패가 시끄러운 쪽</i> 과 방향이 다른데,
 * 여기는 개인 편의 기능이고 <b>사용자가 할 수 있는 일이 없다</b> — 배포마다
 * <i>"그리드 설정이 무효화됐습니다"</i> 를 띄우면 고칠 수 없는 경고가 반복된다
 * (frontend/search-form.md 과 같은 태도다).
 *
 * <p><b>{@code prefJson} 을 열어 보지 않는다.</b> 무엇이 유효한 컬럼인지 아는 것은 화면
 * 선언이며, 서버가 검증하려면 선언을 서버에도 한 벌 두어야 한다.
 */
@Service
@Transactional(readOnly = true)
public class GridPrefService {

    private final SysUserGridPrefRepository preferences;
    private final SysMenuRepository menus;

    public GridPrefService(SysUserGridPrefRepository preferences, SysMenuRepository menus) {
        this.preferences = preferences;
        this.menus = menus;
    }

    /**
     * 시그니처가 맞는 설정만 돌려준다 — UX-13.
     *
     * <p>쓰기가 섞여 있어 {@code readOnly} 가 아니다. <i>읽는 김에 지운다</i> 는 것이
     * 어색해 보이지만, <b>어긋난 것을 발견하는 유일한 시점이 여기</b>다 — 저장 때는 이미
     * 새 시그니처로 덮어쓴다.
     */
    @Transactional
    public GridPref find(String userId, String menuCd, String gridId, String signature) {
        Optional<SysUserGridPref> found =
                preferences.findByUserIdAndMenuCdAndGridId(userId, menuCd, gridId);
        if (found.isEmpty()) {
            return null;
        }
        if (!found.get().getSignature().equals(signature)) {
            preferences.delete(found.get());
            return null;
        }
        return new GridPref(found.get().getPrefJson());
    }

    /** 저장 — 같은 자리에 덮어쓴다. 개인 설정에 이력을 두지 않는다. */
    @Transactional
    public void save(String userId, String menuCd, String gridId, String prefJson, String signature) {
        requireRegisteredMenu(menuCd);
        preferences
                .findByUserIdAndMenuCdAndGridId(userId, menuCd, gridId)
                .ifPresentOrElse(
                        entity -> entity.replace(prefJson, signature),
                        () -> preferences.save(
                                SysUserGridPref.created(userId, menuCd, gridId, prefJson, signature)));
    }

    /**
     * 초기화 — <b>행을 지운다.</b>
     *
     * <p>기본값을 계산해 저장하지 않는다. 기본값은 <b>화면 선언</b>이고 그것은 배포마다
     * 바뀔 수 있다 — 지금의 기본값을 굳혀 두면 <i>초기화했는데 옛 기본값</i> 이 된다.
     */
    @Transactional
    public void reset(String userId, String menuCd, String gridId) {
        preferences.deleteByUserIdAndMenuCdAndGridId(userId, menuCd, gridId);
    }

    private void requireRegisteredMenu(String menuCd) {
        if (!menus.existsById(menuCd)) {
            throw new BusinessException(CommonErrorCode.NOT_FOUND);
        }
    }
}
