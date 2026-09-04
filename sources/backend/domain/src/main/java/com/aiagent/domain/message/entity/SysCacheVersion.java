package com.aiagent.domain.message.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 프론트 캐시의 유효성 기준 — 43 §8.1.
 *
 * <p><b>백엔드 노드끼리 주고받는 신호가 아니다.</b> 폴링하지 않으며 읽는 시점은 로그인과
 * 공개 번들 요청뿐이다. 백엔드에는 노드 간 공유가 필요한 캐시가 없다(ADR-0017).
 *
 * <p>버전은 {@code CACHE_NAME} 단위다 — 코드 그룹 하나가 바뀌어도 프론트의 {@code code}
 * 캐시 전체가 버려진다. 그룹 단위로 두면 표가 코드 그룹 수만큼 늘어난다.
 *
 * <p><b>감사 4컬럼을 상속하지 않는다.</b> 애플리케이션이 기계적으로 쓰는 값이라 <i>"누가"</i>
 * 가 존재하지 않는다(40 §4.2). {@code MOD_DTM} 만 진단용으로 둔다.
 */
@Entity
@Table(name = "SYS_CACHE_VERSION")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysCacheVersion {

    /** 프론트가 {@code localStorage} 를 버리는 단위 — {@code code} · {@code config} · {@code message}. */
    public static final String MESSAGE = "message";

    /** 시스템 환경설정 — {@code CONFIG_MGMT} 의 저장이 올린다(63 §4.7). */
    public static final String CONFIG = "config";

    /**
     * 공통 코드 — {@code CODE_MGMT} 의 저장 셋이 전부 올린다(63 §2.9).
     *
     * <p><b>코드명을 고친 저장은 {@link #MESSAGE} 도 함께 올린다.</b> 이름의 원본이
     * {@code SYS_MESSAGE} 라(43 §3) 프론트가 그 값을 <b>메시지 번들에서</b> 읽기 때문이며,
     * {@code code} 만 올리면 목록은 새것인데 <b>라벨이 옛것</b>인 화면이 나온다.
     */
    public static final String CODE = "code";

    @Id
    @Column(name = "CACHE_NAME", length = 50, nullable = false)
    private String cacheName;

    @Column(name = "VERSION", nullable = false)
    private Long version;

    @Column(name = "MOD_DTM")
    private Instant modDtm;

    /** 표에 이름이 없을 때 만든다 — 시드가 넣어 두지만 없어도 저장이 죽지 않아야 한다. */
    public static SysCacheVersion started(String cacheName, Instant now) {
        SysCacheVersion entity = new SysCacheVersion();
        entity.cacheName = cacheName;
        entity.version = 1L;
        entity.modDtm = now;
        return entity;
    }

    /**
     * <b>저장 한 번에 {@code +1}</b> — 행 수만큼 올리지 않는다(43 §8.1).
     *
     * <p>프론트가 보는 것은 <i>"내가 든 값과 같은가"</i> 뿐이라 얼마나 올랐는지는 뜻이 없다.
     * 행마다 올리면 저장 한 번에 버전이 수십 뛰고, 그 수를 진단에 쓸 수 있다고 착각하게 된다.
     */
    public void bump(Instant now) {
        this.version = this.version + 1;
        this.modDtm = now;
    }
}
