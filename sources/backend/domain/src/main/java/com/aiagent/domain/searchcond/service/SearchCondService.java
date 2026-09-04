package com.aiagent.domain.searchcond.service;

import com.aiagent.core.error.BusinessException;
import com.aiagent.domain.searchcond.SavedSearchCond;
import com.aiagent.domain.searchcond.entity.SysUserSearchCond;
import com.aiagent.domain.searchcond.repository.SysUserSearchCondRepository;
import com.aiagent.support.config.ConfigLookup;
import com.aiagent.support.config.props.SavedCondProps;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 저장된 조회조건 — UX-07 · frontend/search-form.md.
 *
 * <p><b>대상은 언제나 세션의 주인이다.</b> {@code userId} 를 인자로 받되 컨트롤러가
 * {@code Principal} 에서 꺼낸 값이며 요청 본문에서 오지 않는다 — 본문에 두는 순간
 * <i>"누구 것을 고치는가"</i> 가 클라이언트가 보낸 값이 된다.
 *
 * <p><b>{@code condJson} 을 열어 보지 않는다</b>(frontend/search-form.md). 무엇이 유효한 필드인지
 * 아는 것은 <b>화면 선언</b>이고, 서버가 검증하려면 선언을 서버에도 한 벌 두어야 한다 —
 * 그것이 미러링이다. 낡은 키는 복원할 때 화면이 <b>조용히</b> 버린다: 개인 편의 기능이라
 * 배포마다 <i>"저장한 조건 3개가 무효입니다"</i> 를 띄우면 고칠 수 없는 경고가 반복된다.
 *
 * <p><b>기본 조건은 하나다</b>(frontend/search-form.md). DB 로 강제하지 않는 이유는 부분 유니크 인덱스의
 * 문법이 벤더마다 다르기 때문이며(backend/persistence.md), 그래서 <b>내리는 일이 여기 있다</b>.
 */
@Service
@Transactional(readOnly = true)
public class SearchCondService {

    private final SysUserSearchCondRepository conditions;
    private final ConfigLookup configs;

    public SearchCondService(SysUserSearchCondRepository conditions, ConfigLookup configs) {
        this.conditions = conditions;
        this.configs = configs;
    }

    /** 드롭다운이 읽는 목록. <b>내용까지 함께 낸다</b> — 고를 때 다시 부르지 않는다. */
    public List<SavedSearchCond> findMine(String userId, String menuCd) {
        return conditions.findByUserIdAndMenuCdOrderBySortNoAsc(userId, menuCd).stream()
                .map(SearchCondService::toRecord)
                .toList();
    }

    /**
     * 저장 — <b>같은 이름이면 덮어쓴다</b>(frontend/search-form.md 의 <i>이름 중복 불가</i>가 곧 그 뜻이다).
     *
     * <p><b>상한은 새로 만들 때만 본다.</b> 덮어쓰기까지 막으면 상한에 찬 사용자가
     * <b>이미 있는 조건을 고칠 수도 없게</b> 된다 — 그 상태에서 할 수 있는 일은 지우는
     * 것뿐이고, 그것은 상한이 노리는 바가 아니다.
     */
    @Transactional
    public void save(String userId, String menuCd, String condNm, String condJson, boolean dflt) {
        String name = condNm.trim();
        Optional<SysUserSearchCond> existing =
                conditions.findByUserIdAndMenuCdAndCondNm(userId, menuCd, name);

        if (dflt) {
            demoteOthers(userId, menuCd, name);
        }

        if (existing.isPresent()) {
            existing.get().replace(condJson, dflt);
            return;
        }

        int limit = configs.get(SavedCondProps.class).maxCount();
        if (conditions.countByUserIdAndMenuCd(userId, menuCd) >= limit) {
            throw new BusinessException(SearchCondErrorCode.LIMIT_EXCEEDED);
        }

        int sortNo = conditions.findLastSortNo(userId, menuCd) + 1;
        conditions.save(
                SysUserSearchCond.created(userId, menuCd, name, condJson, dflt, sortNo));
    }

    /** 삭제. <b>기본이던 것을 지우면 기본이 없어진다</b> — 다른 것을 자동으로 올리지 않는다. */
    @Transactional
    public void delete(String userId, String menuCd, String condNm) {
        conditions.deleteByUserIdAndMenuCdAndCondNm(userId, menuCd, condNm);
    }

    /**
     * 이전 기본을 내린다.
     *
     * <p>자기 자신은 건너뛴다 — 덮어쓰기 경로에서 방금 내린 행을 다시 올리게 되면
     * <b>같은 트랜잭션 안에서 값이 두 번 뒤집힌다.</b>
     */
    private void demoteOthers(String userId, String menuCd, String keep) {
        for (SysUserSearchCond row : conditions.findByUserIdAndMenuCdOrderBySortNoAsc(userId, menuCd)) {
            if (Boolean.TRUE.equals(row.getDfltYn()) && !row.getCondNm().equals(keep)) {
                row.clearDefault();
            }
        }
    }

    private static SavedSearchCond toRecord(SysUserSearchCond entity) {
        return new SavedSearchCond(
                entity.getCondNm(),
                entity.getCondJson(),
                Boolean.TRUE.equals(entity.getDfltYn()),
                entity.getSortNo());
    }
}
