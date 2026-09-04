package com.ordinary.backoffice.domain.authz.service;

import com.ordinary.backoffice.domain.authz.ApiAuthorityFact;
import com.ordinary.backoffice.domain.authz.entity.SysApi;
import com.ordinary.backoffice.domain.authz.entity.SysMenuApi;
import com.ordinary.backoffice.domain.authz.repository.SysApiRepository;
import com.ordinary.backoffice.domain.authz.repository.SysMenuApiRepository;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code URL → (ACTION_CD, [MENU_CD…])} 맵 — 기동 시 한 번 적재한다(security-design.md §4 권한 캐싱).
 *
 * <p><b>요청당 추가 쿼리 0 이 기본이다.</b> 인가 인터셉터가 매 요청 참조하는 것은 이 맵과
 * 세션의 유효 권한뿐이며 둘 다 미리 적재돼 있다.
 *
 * <p><b>불변이다 — 시드 배포 = 재기동.</b> {@code SYS_API}·{@code SYS_MENU_API} 는 운영 중
 * 편집하는 데이터가 아니라 코드와 함께 배포되는 시드이므로(ADR-0020) 무효화 신호가 필요
 * 없다. 그래서 TTL 도 리프레시 API 도 두지 않는다.
 *
 * <p><b>매칭은 패턴이 아니라 경로 완전 일치</b>다. 업무 API 경로가 고정 문자열이므로
 * (경로 변수·와일드카드 금지 — security-design.md §4) 해시 조회 한 번이면 되고, 새 API 가 기존의 넓은
 * 패턴에 조용히 덮이는 일이 없다.
 *
 * <p><b>{@link ApplicationReadyEvent} 에 적재하는 이유</b> — Liquibase 가 스키마와 시드를
 * 끝낸 뒤여야 한다. {@code @PostConstruct} 는 빈 생성 순서에 기대게 되고, 그 순서는
 * 자동설정이 바뀌면 조용히 달라진다.
 */
@Service
public class ApiAuthorityRegistry {

    private static final Logger log = LoggerFactory.getLogger(ApiAuthorityRegistry.class);

    private final SysApiRepository apis;
    private final SysMenuApiRepository mappings;

    /**
     * 적재 전에는 비어 있다 — 그리고 <b>비어 있는 것이 곧 전부 403</b> 이다(deny by default).
     * 적재에 실패해 조용히 열리는 경로가 없다는 뜻이며, 실패 방향이 이쪽이어야 한다.
     */
    private volatile Map<String, ApiAuthorityFact> facts = Map.of();

    public ApiAuthorityRegistry(SysApiRepository apis, SysMenuApiRepository mappings) {
        this.apis = apis;
        this.mappings = mappings;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional(readOnly = true)
    public void load() {
        Map<String, Set<String>> menusByUrl = mappings.findAll().stream()
                .collect(Collectors.groupingBy(
                        SysMenuApi::getApiUrl,
                        Collectors.mapping(SysMenuApi::getMenuCd, Collectors.toUnmodifiableSet())));

        Map<String, ApiAuthorityFact> loaded = new HashMap<>();
        for (SysApi api : apis.findAll()) {
            loaded.put(
                    api.getApiUrl(),
                    new ApiAuthorityFact(
                            api.getApiUrl(),
                            api.getActionCd(),
                            menusByUrl.getOrDefault(api.getApiUrl(), Set.of())));
        }
        this.facts = Map.copyOf(loaded);

        long unmapped = loaded.values().stream().filter(fact -> !fact.isMapped()).count();
        // 미매핑은 기동을 막지 않는다 — fail-closed 런타임이 이미 받는다(security-design.md §4 deny by default).
        // 다만 조용하면 안 된다: 아무도 권한을 가질 수 없는 API 가 있다는 사실은 배포 직후에
        // 드러나야 하고, 그 자리가 로그다.
        log.info("인가 사실 적재 완료 — API {}건, 매핑 없는 API {}건", loaded.size(), unmapped);
    }

    /** 빈 {@link Optional} 은 <b>미등록</b>이다 — {@code err.api-not-registered}. */
    public Optional<ApiAuthorityFact> find(String apiUrl) {
        return Optional.ofNullable(facts.get(apiUrl));
    }

    public int size() {
        return facts.size();
    }
}
