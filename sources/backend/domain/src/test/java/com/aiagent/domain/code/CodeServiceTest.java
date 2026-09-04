package com.aiagent.domain.code;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aiagent.domain.code.entity.SysCode;
import com.aiagent.domain.code.repository.SysCodeRepository;
import com.aiagent.domain.code.service.CodeService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 콤보가 읽는 코드 — 43 §8.
 *
 * <p>여기서 지키는 것은 <b>요청한 그룹이 하나도 빠지지 않는다</b>는 것이다. 없는 그룹을
 * 응답에서 빼면 프론트 캐시가 <i>"아직 못 받았다"</i> 와 <i>"받았는데 비어 있다"</i> 를
 * 구분하지 못해 화면을 열 때마다 다시 묻는다 — 오타 난 그룹 하나가 영구적인 왕복이 된다.
 */
@ExtendWith(MockitoExtension.class)
class CodeServiceTest {

    @Mock private SysCodeRepository codes;

    private CodeService service;

    @BeforeEach
    void setUp() {
        service = new CodeService(codes);
    }

    @Test
    @DisplayName("그룹별로 갈라 담는다 — 조회는 한 번이다")
    void groupsByGrpCd() {
        when(codes.findForCombo(anyCollection()))
                .thenReturn(List.of(
                        code("LANG_CD", "ko"),
                        code("LANG_CD", "en"),
                        code("CODE_REF_KEY", "PARENT")));

        Map<String, List<String>> result = service.codesOf(List.of("LANG_CD", "CODE_REF_KEY"));

        assertThat(result)
                .containsExactly(
                        Map.entry("LANG_CD", List.of("ko", "en")),
                        Map.entry("CODE_REF_KEY", List.of("PARENT")));
    }

    @Test
    @DisplayName("없는 그룹도 키로 남는다 — 빈 목록이 곧 '받았는데 비어 있다' 는 답이다")
    void keepsUnknownGroupAsEmptyList() {
        when(codes.findForCombo(anyCollection())).thenReturn(List.of(code("LANG_CD", "ko")));

        Map<String, List<String>> result = service.codesOf(List.of("LANG_CD", "NO_SUCH_GROUP"));

        assertThat(result).containsOnlyKeys("LANG_CD", "NO_SUCH_GROUP");
        assertThat(result.get("NO_SUCH_GROUP")).isEmpty();
    }

    @Test
    @DisplayName("같은 그룹을 두 번 적어도 조회는 한 그룹이다")
    void deduplicatesRequestedGroups() {
        when(codes.findForCombo(anyCollection())).thenReturn(List.of(code("LANG_CD", "ko")));

        Map<String, List<String>> result = service.codesOf(List.of("LANG_CD", "LANG_CD"));

        assertThat(result).containsOnlyKeys("LANG_CD");
        assertThat(result.get("LANG_CD")).containsExactly("ko");
    }

    @Test
    @DisplayName("빈 요청은 DB 를 치지 않는다 — 'in ()' 은 문법도 되지 않는다")
    void skipsQueryWhenNothingAsked() {
        assertThat(service.codesOf(List.of())).isEmpty();

        verify(codes, never()).findForCombo(anyCollection());
    }

    /** 저장 경로를 지나지 않고 만든다 — 정렬과 {@code USE_YN} 은 쿼리의 몫이라 여기 없다. */
    private static SysCode code(String grpCd, String dtlCd) {
        return SysCode.created(grpCd, dtlCd, null, true, 1);
    }
}
