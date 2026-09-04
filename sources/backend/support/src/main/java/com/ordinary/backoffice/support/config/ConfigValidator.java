package com.ordinary.backoffice.support.config;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 저장하려는 값이 <b>바인딩을 통과하는가</b> — 63 §4.5 · ADR-0026 §3.
 *
 * <p>43 §6.2 가 제약의 단일 원본을 {@code @Validated} 바인딩 객체로 정했다. <b>화면이 그
 * 규칙을 복제하면 원본이 둘이 된다</b> — 그래서 저장 경로는 규칙을 다시 적는 대신
 * <b>실제로 바인딩해 본다.</b> {@code @Min} 도, {@code window-months ≤ keep-months} 같은
 * 상호 제약도, 타입 변환 실패도 <b>같은 문 하나</b>에서 걸린다.
 *
 * <p><b>읽기와 같은 문이다.</b> 바인딩은 {@link ConfigBinder} 가 하며 {@link ConfigLookup}
 * 도 그것을 쓴다 — 문이 둘이면 <b>저장이 통과시킨 값을 읽기가 거부</b>할 수 있다.
 *
 * <p><b>전량이지 델타가 아니다.</b> 상호 제약은 형제 값을 봐야 판정되므로 바꾼 키만 얹으면
 * <i>"둘을 함께 올리는"</i> 저장이 <b>중간 상태에서 거부</b>된다.
 */
@Component
public class ConfigValidator {

    private final ConfigCatalog catalog;
    private final ConfigBinder binder;

    public ConfigValidator(ConfigCatalog catalog, ConfigBinder binder) {
        this.catalog = catalog;
        this.binder = binder;
    }

    /**
     * 오버라이드 전량을 얹어 <b>전 props 클래스</b>를 한 번 바인딩한다.
     *
     * <p><b>비어 있으면 통과다</b> — 반환이 빈 목록이면 저장해도 된다는 뜻이고, 그 판정은
     * <i>규칙을 읽어서</i> 가 아니라 <i>만들어 봐서</i> 나온 것이다.
     *
     * <p><b>첫 실패에서 멈추지 않는다.</b> 화면은 일괄 저장이라 여러 셀이 함께 틀릴 수 있고,
     * 하나씩 돌려보내면 <b>고칠 때마다 저장을 다시 눌러야</b> 한다.
     *
     * @param overrides {@code CFG_KEY → CFG_VAL}. 루트({@code sys-config.})가 붙지 않은 키다
     */
    public List<ConfigViolation> validate(Map<String, String> overrides) {
        List<ConfigViolation> violations = new ArrayList<>();

        for (Class<?> type : catalog.propsClasses()) {
            try {
                binder.bind(type, overrides);
            } catch (RuntimeException e) {
                violations.addAll(ConfigBinder.translate(ConfigCatalog.prefixOf(type), e));
            }
        }
        return violations;
    }
}
