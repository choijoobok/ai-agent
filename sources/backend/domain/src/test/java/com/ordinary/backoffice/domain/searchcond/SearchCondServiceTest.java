package com.ordinary.backoffice.domain.searchcond;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ordinary.backoffice.core.error.BusinessException;
import com.ordinary.backoffice.domain.searchcond.entity.SysUserSearchCond;
import com.ordinary.backoffice.domain.searchcond.repository.SysUserSearchCondRepository;
import com.ordinary.backoffice.domain.searchcond.service.SearchCondErrorCode;
import com.ordinary.backoffice.domain.searchcond.service.SearchCondService;
import com.ordinary.backoffice.support.config.ConfigLookup;
import com.ordinary.backoffice.support.config.props.SavedCondProps;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * 저장된 조회조건 — UX-07 · search-form-contract.md §5.
 *
 * <p>여기서 지키는 것 셋이다 — ① <b>기본은 하나</b>(DB 가 강제하지 않으므로 이 코드가
 * 유일한 보증이다), ② <b>상한은 새로 만들 때만</b> 본다, ③ <b>같은 이름은 덮어쓴다</b>.
 *
 * <p>①이 조용히 깨지는 종류다. 둘이 {@code 'Y'} 여도 저장은 성공하고 목록도 정상으로
 * 보이며, 다음 진입에서 <b>둘 중 아무거나</b> 폼에 실린다.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SearchCondServiceTest {

    private static final String USER = "kim";
    private static final String MENU = "MESSAGE_MGMT";
    private static final String JSON = "{}";

    @Mock private SysUserSearchCondRepository conditions;
    @Mock private ConfigLookup configs;

    private SearchCondService service;

    @BeforeEach
    void setUp() {
        service = new SearchCondService(conditions, configs);
        when(configs.get(SavedCondProps.class)).thenReturn(new SavedCondProps(3));
        when(conditions.findByUserIdAndMenuCdAndCondNm(any(), any(), any()))
                .thenReturn(Optional.empty());
    }

    private static SysUserSearchCond row(String name, boolean dflt, int sortNo) {
        return SysUserSearchCond.created(USER, MENU, name, JSON, dflt, sortNo);
    }

    private void existing(SysUserSearchCond... rows) {
        List<SysUserSearchCond> list = List.of(rows);
        when(conditions.findByUserIdAndMenuCdOrderBySortNoAsc(USER, MENU)).thenReturn(list);
        when(conditions.countByUserIdAndMenuCd(USER, MENU)).thenReturn((long) list.size());
        when(conditions.findLastSortNo(USER, MENU)).thenReturn(list.size());
        for (SysUserSearchCond entity : list) {
            when(conditions.findByUserIdAndMenuCdAndCondNm(USER, MENU, entity.getCondNm()))
                    .thenReturn(Optional.of(entity));
        }
    }

    @Nested
    @DisplayName("기본 조건")
    class Default {

        @Test
        @DisplayName("새 기본이 서면 이전 기본이 내려온다 — DB 는 이것을 막지 못한다")
        void demotesPrevious() {
            SysUserSearchCond old = row("어제", true, 1);
            existing(old);

            service.save(USER, MENU, "오늘", JSON, true);

            // 부분 유니크 인덱스는 벤더마다 문법이 다르다(db-portability.md §4) — 그래서 여기가 유일한 보증이다.
            assertThat(old.getDfltYn()).isFalse();
        }

        @Test
        @DisplayName("기본이 아닌 것을 저장하면 남의 기본을 건드리지 않는다")
        void keepsOtherDefault() {
            SysUserSearchCond old = row("어제", true, 1);
            existing(old);

            service.save(USER, MENU, "오늘", JSON, false);

            assertThat(old.getDfltYn()).isTrue();
        }

        @Test
        @DisplayName("자기를 덮어쓸 때 자기를 내리지 않는다 — 같은 트랜잭션에서 두 번 뒤집힌다")
        void doesNotDemoteItself() {
            SysUserSearchCond mine = row("오늘", true, 1);
            existing(mine);

            service.save(USER, MENU, "오늘", "{\"a\":1}", true);

            assertThat(mine.getDfltYn()).isTrue();
            assertThat(mine.getCondJson()).isEqualTo("{\"a\":1}");
        }
    }

    @Nested
    @DisplayName("상한")
    class Limit {

        @Test
        @DisplayName("가득 찬 뒤 새로 만들면 거절한다 — 가장 오래된 것을 조용히 밀어내지 않는다")
        void rejectsNew() {
            existing(row("a", false, 1), row("b", false, 2), row("c", false, 3));

            assertThatThrownBy(() -> service.save(USER, MENU, "d", JSON, false))
                    .isInstanceOf(BusinessException.class)
                    .extracting(error -> ((BusinessException) error).errorCode())
                    .isEqualTo(SearchCondErrorCode.LIMIT_EXCEEDED);

            verify(conditions, never()).save(any());
        }

        @Test
        @DisplayName("가득 차도 이미 있는 것은 고칠 수 있다 — 막으면 지우는 것 말고 할 일이 없다")
        void allowsOverwrite() {
            existing(row("a", false, 1), row("b", false, 2), row("c", false, 3));

            service.save(USER, MENU, "b", "{\"x\":1}", false);

            assertThat(conditions.findByUserIdAndMenuCdOrderBySortNoAsc(USER, MENU))
                    .filteredOn(entity -> entity.getCondNm().equals("b"))
                    .singleElement()
                    .extracting(SysUserSearchCond::getCondJson)
                    .isEqualTo("{\"x\":1}");
        }
    }

    @Test
    @DisplayName("새 조건의 순번은 최대값 + 1 이다 — 빈 자리를 메우지 않는다")
    void appendsAtEnd() {
        existing(row("a", false, 1), row("b", false, 2));
        ArgumentCaptor<SysUserSearchCond> saved = ArgumentCaptor.forClass(SysUserSearchCond.class);

        service.save(USER, MENU, "c", JSON, false);

        verify(conditions).save(saved.capture());
        // 순서는 만든 순서다 — 이름 순으로 재배열하면 자주 쓰는 것이 아래로 밀린다.
        assertThat(saved.getValue().getSortNo()).isEqualTo(3);
    }

    @Test
    @DisplayName("이름의 앞뒤 공백을 지운다 — 눈에 보이지 않는 두 항목이 생긴다")
    void trimsName() {
        existing();
        ArgumentCaptor<SysUserSearchCond> saved = ArgumentCaptor.forClass(SysUserSearchCond.class);

        service.save(USER, MENU, "  최근 것  ", JSON, false);

        verify(conditions).save(saved.capture());
        assertThat(saved.getValue().getCondNm()).isEqualTo("최근 것");
    }
}
